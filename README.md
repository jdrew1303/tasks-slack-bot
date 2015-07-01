Slack bot for 99designs Tasks
----

[99designs Tasks](https://99designs.com/tasks/) is for getting small graphic design tasks completed by professional designers straight from [Slack](https://slack.com/). Results are typically in under an hour.

[Get in touch](mailto:dennis@99designs.com) and we'll give you some freebies to try it out. :-)

## Demo

https://youtu.be/URxdpAU2mqc

## Installation

1. Create a slack bot user: https://slack.com/services/new/bot
2. Create a 99designs Tasks API key: https://99designs.com/tasks/apikeys
3. Install and run the bot like this:

```
    mkdir tasks-bot && cd tasks-bot
    npm install git+https://git@github.com/99designs/tasks-slack-bot.git
    node ./node_modules/.bin/tasks-bot \
      --slack-key=xoxb-xxxx-xxxxxx \
      --tasks-key=xxxxxxxxx \
      --webhook-url=http://my-server.com:9090/ \
      --host=0.0.0.0 \
      --port=9090
```

## Need help?

Join us on our developer slack channel:

[![](https://slackin-99designs-api.herokuapp.com/badge.svg)](https://slackin-99designs-api.herokuapp.com/)
