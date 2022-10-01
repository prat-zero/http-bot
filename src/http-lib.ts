import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import nacl from "tweetnacl";
import EventEmitter from "events";
import TypedEmitter from "typed-emitter";
import {
  APIInteraction,
  InteractionResponseType,
  InteractionType,
} from "discord-api-types/v10";

type HTTPDiscordClientOptions = {
  interactionsRoute: string;
  clientPublicKey: string;
  clientToken: string;
  clientId: string;
};

type HTTPDiscordClientEvents = {
  start: () => void;
  interactionCreate: (
    interaction: HTTPDiscordClientInteractionEventObject
  ) => void;
};

declare interface HTTPDiscordClientInteractionEventObject {
  data: APIInteraction;
  response: Response;
}

class HTTPDiscordClient extends (EventEmitter as new () => TypedEmitter<HTTPDiscordClientEvents>) {
  protected router = express();
  protected config: HTTPDiscordClientOptions;

  constructor(options: HTTPDiscordClientOptions) {
    super();
    this.config = options;
    this.addInteractionsRoute();
  }

  get internalRouter() {
    return this.router;
  }

  start(port: number) {
    this.router.listen(port);
    this.emit("start");
  }

  close() {
    this.router;
  }

  protected addInteractionsRoute() {
    this.router.post(
      this.config.interactionsRoute,
      this.verifyMiddleware(this.config.clientPublicKey),
      (req, res) => {
        const i = req.body as APIInteraction;

        this.emit("interactionCreate", {
          data: i,
          response: res,
        });

        return;
      }
    );
  }

  protected verifyMiddleware(
    clientPublicKey: string
  ): (req: Request, res: Response, next: NextFunction) => void {
    return function (req: Request, res: Response, next: NextFunction) {
      const timestamp = (req.header("X-Signature-Timestamp") || "") as string;
      const signature = (req.header("X-Signature-Ed25519") || "") as string;

      function onBodyComplete(rawBody: Buffer) {
        const _ = Buffer.from(rawBody).toString();

        const isVerified = nacl.sign.detached.verify(
          Buffer.from(timestamp + _),
          Buffer.from(signature, "hex"),
          Buffer.from(clientPublicKey, "hex")
        );

        if (!isVerified) {
          res.statusCode = 401;
          res.end("Invalid request signature");
          return;
        }

        const body = (JSON.parse(rawBody.toString()) || {}) as APIInteraction;
        res.setHeader("Content-Type", "application/json");

        if (body.type === InteractionType.Ping) {
          res.end(
            JSON.stringify({
              type: InteractionResponseType.Pong,
            })
          );
          return;
        }

        req.body = body;
        next();
      }

      if (req.body) {
        if (Buffer.isBuffer(req.body)) {
          onBodyComplete(req.body);
        }

        if (typeof req.body === "string") {
          onBodyComplete(Buffer.from(req.body, "utf-8"));
        } else {
          onBodyComplete(Buffer.from(JSON.stringify(req.body), "utf-8"));
        }
      } else {
        const chunks: Array<Buffer> = [];
        req.on("data", (chunk) => {
          chunks.push(chunk);
        });
        req.on("end", () => {
          const rawBody = Buffer.concat(chunks);
          onBodyComplete(rawBody);
        });
      }
    };
  }
}

export {
  HTTPDiscordClientOptions,
  HTTPDiscordClientEvents,
  HTTPDiscordClient,
  HTTPDiscordClientInteractionEventObject,
};
