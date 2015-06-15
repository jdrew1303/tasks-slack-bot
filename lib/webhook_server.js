var http = require('http');
var CryptoJS = require("crypto-js");

var WebhookServer = module.exports = function(port, host) {
  var teams = {};

  var server = http.createServer(function (req, res) {
    console.log(req.url);
    console.log(req.headers);
    var matches = req.url.match(/^\/([^:]+):(.*)$/); // Expects an URL of the form `/<team>:<channel>` e.g. `/T024F8FD8:D063VDLS2`
    if (!matches) {
      console.error('BAD URL');
      res.writeHead(404);
      return res.end();
    }

    var teamid = matches[1];
    var channel = matches[2];

    var body = '';
    req.on('data', function(chunk) {
      body += chunk;
    });

    req.on('end', function() {
      console.log(body);

      var team = teams[teamid];
      if (!team) {
        console.error('INVALID TEAM', team, teamid);
        res.writeHead(400, {'Content-Type': 'text/plain'});
        res.end();
        return;
      }

      var sig = CryptoJS.HmacSHA256(body, team.tasksKey)
      if (sig.toString() !== req.headers['x-99designs-signature']) {
        console.log('!!!!', sig.toString(), req.headers['x-99designs-signature']);
        res.writeHead(400, {'Content-Type': 'text/plain'});
        res.end();
        return;
      }

      try {
        var payload = JSON.parse(body);
      } catch (e) {
        console.error('BAD JSON', body);
        res.writeHead(400, {'Content-Type': 'text/plain'});
        res.end();
        return;
      }

      team.bot.notify(channel, payload);

      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.end();
    });

  }).listen(port, host);

  return {
    registerTeam: function(team, tasksKey, bot) {
      teams[team] = { bot: bot, tasksKey: tasksKey };
    }
  };
};
