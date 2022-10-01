require("dotenv").config();
import {
  InteractionResponseType,
  InteractionType,
  MessageFlags,
} from "discord-api-types/v10";
import { HTTPDiscordClient } from "./http-lib";

const client = new HTTPDiscordClient({
  interactionsRoute: "/snowflake/interactions",
  clientPublicKey: process.env.CLIENT_PUBLIC_KEY!,
  clientId: process.env.CLIENT_ID!,
  clientToken: process.env.CLIENT_TOKEN!,
});

client.on("start", () => {
  console.log("Ready!");
});

client.on("interactionCreate", ({ data: interaction, response }) => {
  if (interaction.type === InteractionType.ApplicationCommand) {
    if (interaction.data.name === "beep") {
      response.end(
        JSON.stringify({
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            flags: MessageFlags.Ephemeral,
            content: "Boop!",
          },
        })
      );
    }
  }
});

client.start(3001);
