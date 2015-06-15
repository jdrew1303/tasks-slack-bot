var SlackClient = require('slack-client');
var tasks = require('99designs-tasks');
var url = require('url');

var Bot = module.exports = function Bot(slackKey, tasksKey, webhookBaseUrl, webhookServer) {
  var bot = Object.create({});

  var slackClient = new SlackClient(slackKey);
  var tasksClient = tasks.apiClient(tasksKey);

  // User conversation states
  var users = {};

  // Bot user .. For detecting messages by ourselves
  var self;

  var team;

  slackClient.on('loggedIn', function(user, t) {
    self = user;
    team = t;

    console.log("Logged in as "+self.name+" of "+team.name+", but not yet connected");

    webhookServer.registerTeam(team.id, tasksKey, bot);
  });

  slackClient.on('open', function() {
    console.log('Connected');
  });

  // Reply with plain text response
  var reply = function(channel, text) {
    console.log(channel, text);
    var channel = slackClient.getDMByID(channel);
    channel.send(text);
  };

  // Reply with formatted text response (so that <url|label> style links work)
  var replyFormatted = function(channel, text) {
    var channel = slackClient.getDMByID(channel);
    channel.postMessage({
      unfurl_links: false,
      text: text,
      as_user: true,
    });
  };

  var defaultState = function() {
    return { state: 'idle', files: [] };
  };

  var formatTaskList = function(results) {
    var items = results.items.map(function(task) {
      var states = {
        'canceled': "Canceled ❌",
        'available': "Matching in progress… 🔄",
        'in_progress': "In progress 🕑",
        'delivered': "Delivered 🚚",
        'revision_requested': "Revision requested 💬",
        'approved': "Approved ✅",
        'on_hold': "on hold :exclamation:",
      }

      var stateText = states[task.state.code];
      return '• <https://99designs.com/tasks/'+task.id+'|“'+task.body.substring(0, 40).replace(/\s/g, ' ') +'…”> — '+stateText;
    });

    return items.join('\n') || 'No tasks';
  };

  var externalId = function(message) {
    return team.id + ':' + message.channel;
  };

  slackClient.on('message', function(message) {
    // Ignore our own messages
    if (message.user == self.id) return;

    // Direct messages only
    if (message.getChannelType() != 'DM') return;

    var user = users[message.user] || (users[message.user] = defaultState());
    var channel = message.channel;

    if (message.upload) {
      if (user.state == 'idle') {
        user.state = 'first_upload';
        reply(channel, 'Ok, cool. What would you like done to this file? (feel free to upload more files)')
      } else if (user.state == 'first_upload') {
        user.state = 'more_uploads';
        reply(channel, 'Once you\'ve finished uploading files, just type a description of the changes you would like done to these files.')
      }

      user.files.push(message.file.url);

    } else if (message.text) {
      console.log(externalId(message));

      if (message.text.match(/^m(o(r(e)?)?)?$/) || message.text.match(/^n(e(x(t)?)?)?$/)) {
        if (user.nextPage) {
          slackClient._send({ type: "typing", channel: message.channel });
          tasksClient.myTasks({ externalId: externalId(message), page: user.nextPage, perPage: 5 }, function(err, results) {
            if (err) return console.error(err);

            user.nextPage = null;
            results.links.forEach(function(link) {
              if (link.rel == 'next') {
                user.nextPage = url.parse(link.href, true).query.page;
              }
            });

            replyFormatted(channel, formatTaskList(results) + (user.nextPage ? '' : '\n\n--end of list--'));
          });
        } else {
          reply(channel, 'Sorry, there\'s no more.');
        }
        return;
      }

      if (message.text.match(/^l(i(s(t)?)?)?$/) || message.text.match(/^s(t(a(t(u(s)?)?)?)?)?$/)) {
        slackClient._send({ type: "typing", channel: message.channel });
        tasksClient.myTasks({ externalId: externalId(message), perPage: 5 }, function(err, results) {
          if (err) {
            console.error(err);
            return;
          }

          user.nextPage = null;
          results.links.forEach(function(link) {
            if (link.rel == 'next') {
              user.nextPage = url.parse(link.href, true).query.page;
            }
          });

          replyFormatted(channel, formatTaskList(results) + (user.nextPage ? "\n\nType 'more' to see older tasks" : '\n\n--end of list--'));
        });
        return;
      }

      // Taskbot knows how to accept a compliment
      if (message.text.replace(/[^a-zA-Z]+/ig,' ').trim().match(/^(ok |okay |cool |wow )?(thanks|thank you( very much)?|thx|cheers)$/i)) {
        reply(channel, "No problem. :sunglasses:");
        return;
      }

      if (user.state == 'idle') {
        reply(channel, 'Hello. Upload a file to get started. :simple_smile:');
      } else {
        delete users[message.user];
        slackClient._send({ type: "typing", channel: message.channel });
        console.log({ body: message.text, urls: user.files, webhookUrl: webhookBaseUrl + externalId(message), externalId: externalId(message) });
        tasksClient.createTask({ body: message.text, urls: user.files, webhookUrl: webhookBaseUrl + externalId(message), externalId: externalId(message) }, function(err, task) {
          if (err) {
            console.error(err);
            reply(channel, 'Hmm, something went wrong: '+err.message)
            return;
          }

          var taskLink = 'https://99designs.com/tasks/'+task.id; // Default to task link that requires login
          task.links.forEach(function(link) {
            if (link.rel == 'private_web_url') {
              taskLink = link.href; // Upgrade to task link that doesnt require login if available
            }
          });

          reply(channel, 'No worries. Here\'s a link to your task: '+taskLink+' -- I\'ll ping you when it\'s ready.');
          slackClient._send({ type: "typing", channel: message.channel });
          setTimeout(function() {
            reply(channel, "By the way, you can type 'status' to check on your Task at any time.");
          }, 1000);
        });
      }
    }
  });

  slackClient.login();

  var notify = bot.notify = function(channel, payload) {
    console.log('NOTIFY!', channel, payload);
    if (payload.taskid) {
      tasksClient.getTask(payload.taskid, function(err, task) {
        if (err) {
          return console.error(err);
        }

        var taskLink = 'https://99designs.com/tasks/'+task.id; // Default to task link that requires login
        task.links.forEach(function(link) {
          if (link.rel == 'private_web_url') {
            taskLink = link.href; // Upgrade to task link that doesnt require login if available
          }
        });

        var msg;
        if (payload.event == 'delivery_submitted') {
          msg = ':bell: Your task is ready for approval: <'+taskLink+'|View task>';
        } else if (payload.event == 'comment_posted') {
          msg = ':bell: You have a new comment waiting for you: <'+taskLink+'|View task>';
        } else if (payload.event == 'task_on_hold') {
          msg = ':bell: Your Task has been put on hold: <'+taskLink+'|View task>';
        } else if (payload.event == 'task_canceled') {
          msg = ':bell: Your Task has been canceled: <'+taskLink+'|View task>';
        } else if (payload.event == 'delivery_auto_approved') {
          msg = ':bell: Your Task has been auto-approved after 72 hours: <'+taskLink+'|View task>';
        }

        if (msg) {
          replyFormatted(channel, msg);
        }
      });
    }
  };

  return bot;
};

