Slack bot for 99designs Tasks
----

1. Create a slack bot user: https://99designs.slack.com/services/new/bot
2. Create a 99designs Tasks API key: https://99designs.com/tasks/apikeys
3. Install and run the bot like this:

```
    mkdir tasks-bot && cd tasks-bot
    npm install git+ssh://git@github.com:99designs/tasks-slack-bot.git
    node ./node_modules/.bin/tasks-bot \
      --slack-key=xoxb-xxxx-xxxxxx \
      --tasks-key=xxxxxxxxx \
      --webhook-url=http://my-server.com:9090/ \
      --host=0.0.0.0 \
      --port=9090
```
