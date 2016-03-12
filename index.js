var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var Crawler = require('crawler');

app.use(express.static('public'));

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html');
});

var intervalSendAds, intervalRequestAds;
var displayedAds = [], queuedAds = [], adsMap = [];
for (var i = 0; i < 10; i++) {
  adsMap.push([]); // Generate matrix adsMap
}
var defaultAds = 'http://static.chotot.com.vn/img/DefaultAdImage.jpg'; // Skip this default image
var stopRequest = false;

// Config image crawler
var listUrl = ['http://www.chotot.vn/tp-ho-chi-minh/mua-ban', 'http://www.chotot.vn/ha-noi/mua-ban'];
var c = new Crawler({
  maxConnections : 10,
  callback: function (error, result, $) {
    if (error) {
      io.emit('crawlerError', error);
      return;
    }
    if (stopRequest) {
      return;
    }

    // Check for new ads every 40s
    if (intervalRequestAds) {
      clearInterval(intervalRequestAds);
    }
    intervalRequestAds = setInterval(function () {
      requestAds();
    }, 40000);

    // Parse ads & add to adsMap & queue
    $('div.listing_thumbs_image img.thumbnail').each(function(index, img) {
      var url = $(img).attr('src') === defaultAds ? $(img).attr('data-original') : $(img).attr('src');
      if (!isDuplicated(url)) {
        addAds(url);
      }
    });

    // Send ads to client every 3.5s
    if (!intervalSendAds && queuedAds.length !== 0) {
      intervalSendAds = setInterval(function () {
        if (queuedAds.length === 0) {
          return;
        }
        var ads = queuedAds.shift();
        displayedAds.push(ads);
        sendAdsToClient(ads);
        console.log('Sent', displayedAds.length, '/', displayedAds.length + queuedAds.length, 'ads');
      }, 3500);
      return;
    }

    // Stop send ads if queue is empty
    if (intervalSendAds && queuedAds.length === 0) {
      clearInterval(intervalSendAds);
      intervalSendAds = null;
    }
  }
});

function addAds(url) {
  var ads = addUrlToMap(url);
  queuedAds.push(ads);
}

function sendAdsToClient(ads) {
  io.emit('newAds', ads);
}

function addUrlToMap(url) {
  var col;
  do {
    col = randomNumInRange(0, 9); // Display ads in 10 column
  } while (adsMap[col].length === 5); // Max images in column is 5
  var ads = { col: col, url: url, id: getSimpleID() };
  adsMap[col].push(ads);
  return ads;
}

function getSimpleID() {
  return s4() + '-' + s4();
}

function s4() {
  return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
}

function randomNumInRange(min, max) {
  return Math.floor(Math.random() * max) + min;
}

function isDuplicated(url) {
  var duplicated = false;
  adsMap.map(function (col) {
    for (var i = 0; i < col.length; i++) {
      if (url === col[i].url) {
        duplicated = true;
      }
    }
  });
  return duplicated;
}

function requestAds() {
  console.log('requestAds');
  c.queue(listUrl);
}

function removeAds(ads) {
  for (var i = 0; i < displayedAds.length; i++) {
    if (displayedAds[i].id === ads.id) {
      displayedAds.splice(i, 1);
      break;
    }
  }
  for (var j = 0; j < adsMap[ads.col].length; j++) {
    if (adsMap[ads.col][j].id === ads.id) {
      adsMap[ads.col].splice(j, 1);
      break;
    }
  }
}

function swapAds(sourceId, targetId) {
  var source, sourceIndex, target, targetIndex, tempCol;

  // Get source & target ads object
  for (var i = 0; i < displayedAds.length; i++) {
    if (displayedAds[i].id === sourceId) {
      source = displayedAds[i];
      sourceIndex = i;
      continue;
    }
    if (displayedAds[i].id === targetId) {
      target = displayedAds[i];
      targetIndex = i;
    }
  }

  // Swap column
  tempCol = source.col;
  source.col = target.col;
  target.col = tempCol;

  // Swap ads in displayedAds
  displayedAds[sourceIndex] = target;
  displayedAds[targetIndex] = source;

  // Swap ads in adsMap
  adsMap[target.col].map(function (ads) {
    if (ads.id === source.id) {
      return target;
    }
    return ads;
  });
  adsMap[source.col].map(function (ads) {
    if (ads.id === target.id) {
      return source;
    }
    return ads;
  });
  return { source: source, target: target };
}

io.on('connection', function(socket) {
  console.log('User connected.');

  // Send displayedAds
  socket.emit('displayedAds', displayedAds);

  // Start requestAds
  if (!intervalRequestAds) {
    requestAds();
  }

  // Stop requestAds
  socket.on('stopRequest', function() {
    clearInterval(intervalSendAds);
    clearInterval(intervalRequestAds);
    stopRequest = true;
    io.emit('gameOver');
  });

  // Clear ads at the bottom
  socket.on('clearLastRow', function (listAds) {
    listAds.map(removeAds);
    io.emit('lastRowCleared');
  });

  // Swap ads
  socket.on('requestSwapAds', function (listAds) {
    var result = swapAds(listAds.sourceId, listAds.targetId);
    io.emit('swapAds', result);
  });

});

http.listen(3000, function() {
  console.log('Server listening on port 3000');
});
