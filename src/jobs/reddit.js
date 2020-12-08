/* eslint-disable-next-line no-unused-vars */
import { TextChannel, Client, Constants, MessageEmbed, Message } from 'discord.js';
import config from '../../config/index.js';
import { fetchPosts } from '../api/index.js';

/** @type {number} */
let newestPostAt;

/**
 * Filter posts to display those posted after a specific date
 *
 * @type {function(Number): function(Post): boolean}
*/
const filterOnlyNewOnes = (newestPostAt) => (post) => newestPostAt ? post.createdAt > newestPostAt : true;

/**
 * Process the fetched posts in order to send them
 *
 * @param {Object} params
 * @param {TextChannel} params.channel - Channel where to send the message
 * @param {Post[]} params.posts - Posts to send
 */
const processAndSend = ({ channel, posts = [] }) => {
  if (!channel) {
    throw new Error(`There's no valid channel to send the message`);
  }

  [...posts].reverse().forEach(post => channel.send({ embed: generateEmbed(post) }));
};

/**
 * Generate the embeded object to be sent to the channel
 *
 * @param {Post} post
 * @returns {MessageEmbed} Object to embedded in message
 */
const generateEmbed = (post) => {
  const embed = {
    color: Constants.Colors.RED,
    url: `https://reddit.com/r/${config.reddit.subreddit}`,
    title: `New post on /r/${config.reddit.subreddit}`,
    description: `[${post.title}](${post.url})`,
    fields: [
      {
        name: '\u200b',
        value: '\u200b',
        inline: false,
      },
    ],
  };

  if (post.description) {
    embed.fields.unshift({
      name: '\u200b',
      value: `>>> ${post.description.slice(0, 1000)}...`,
      inline: false,
    });
  }

  if (post.thumbnail) {
    embed.image = {
      url: post.thumbnail,
    };
  }

  if (post.createdAt) {
    embed.timestamp = post.createdAt; // epoch to miliseconds
  }

  if (post.author) {
    embed.fields.push({
      name: 'Post Author',
      value: `[${post.author}](https://reddit.com/u/${post.author})`,
      inline: true,
    });
  }

  embed.fields.push({
    name: 'Content Warning',
    value: post.isNSFW ? '18+' : 'None',
    inline: true,
  });

  return /** @type {MessageEmbed} */ (embed);
};

export default {
  /**
   * @async
   * @param {Client} discordClient
  */
  async run(discordClient) {
    /** @type {TextChannel} */
    const redditChannel = (await discordClient.channels.fetch(config.channels.redditFeed));

    if (!newestPostAt) {
      /** @type {unknown} */
      const messages = await redditChannel.messages.fetch({ limit: 1 });
      const lastMessage = /** @type {Message[]} */ (messages).find(message => message.author.bot);

      if (lastMessage?.embeds?.length) {
        newestPostAt = lastMessage.embeds[0].timestamp;
      }
    }

    const grabThemPosts = () => {
      fetchPosts().then(posts => {
        const filteredPosts = posts.filter(filterOnlyNewOnes(newestPostAt));

        processAndSend({ channel: redditChannel, posts: filteredPosts });

        if (filteredPosts.length) {
          console.log(`Reddit :: Sent ${filteredPosts.length} new post(s) to #${redditChannel.name}`);
        }

        const [newest] = posts;

        if (newest) {
          newestPostAt = newest.createdAt;
        }
      });
    };

    setImmediate(grabThemPosts);
    setInterval(grabThemPosts, config.reddit.pollInterval * 1000);
  },
}
