var http = require('http');
var CryptoJS = require("crypto-js");
var Log = require('log');

var WebhookServer = module.exports = function(port, host) {
  var logger = new Log(process.env.LOG_LEVEL || 'info');
  var teams = {};

  var server = http.createServer(function (req, res) {
    logger.debug(req.url);
    logger.debug(req.headers);
    var matches = req.url.match(/^\/([^:]+):(.*)$/); // Expects an URL of the form `/<team>:<channel>` e.g. `/T024F8FD8:D063VDLS2`
    if (!matches) {
      logger.error('Unexpected URL');
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
      logger.debug(body);

      var team = teams[teamid];
      if (!team) {
        logger.error('Invalid team: %s %s', team, teamid);
        res.writeHead(400, {'Content-Type': 'text/plain'});
        res.end();
        return;
      }

      var sig = CryptoJS.HmacSHA256(body, team.tasksKey)
      if (sig.toString() !== req.headers['x-99designs-signature']) {
        logger.error('Signature didnt match: %s <-> %s', sig.toString(), req.headers['x-99designs-signature']);
        res.writeHead(400, {'Content-Type': 'text/plain'});
        res.end();
        return;
      }

      try {
        var payload = JSON.parse(body);
      } catch (e) {
        logger.error('Invalid JSON: `%s`', body);
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
