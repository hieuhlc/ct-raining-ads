var socket = io();
var dragElement = null;

socket.on('displayedAds', function (adsList) {
  adsList.map(function (ads) {
    showAds(ads, { noEffect: true });
  });
});

socket.on('newAds', function (ads) {
  showAds(ads);
});

socket.on('crawlerError', function (err) {
  alert('Error fetching data from server!');
  console.log('crawlerError', err);
  endGame();
});

socket.on('lastRowCleared', function () {
  var lastRow = $('.column .imageContainer:first-child');
  lastRow.css('opacity', '0');
  setTimeout(function () {
    lastRow.remove();
  }, 500);
});

socket.on('swapAds', function (listAds) {
  var sourceElement = $('.imageContainer[data-id="' + listAds.source.id + '"]');
  var targetElement = $('.imageContainer[data-id="' + listAds.target.id + '"]');
  var tempHTML = sourceElement.html();
  sourceElement.html(targetElement.html());
  targetElement.html(tempHTML);
  sourceElement.data('id', listAds.target.id);
  targetElement.data('id', listAds.source.id);
});

socket.on('gameOver', function () {
  console.log('Game over.');
});

function showAds(ads, options) {
  if (options && options.noEffect) {
    $('.column:nth-child(' + (ads.col + 1) + ')').append('<div class="imageContainer" '
      + 'data-id="' + ads.id + '" ondrop="handleDrop(event)" '
      + 'draggable="true"><img src="' + ads.url + '"></div>');
    return;
  }
  $('.column:nth-child(' + (ads.col + 1) + ')').append('<div class="imageContainer slideInDown" '
    + 'data-id="' + ads.id + '" ondrop="handleDrop(event)" '
    + 'draggable="true"><img src="' + ads.url + '"></div>');
  setTimeout(function () {
    $('div.slideInDown').removeClass('slideInDown');
    if ($('.imageContainer img').length > 49) {
      clearLastRow();
    }
  }, 1000);
}

function clearLastRow() {
  var lastRowAds = $('.column .imageContainer:first-child');
  var listAds = [];
  lastRowAds.map(function (col, ads) {
    listAds.push({ id: ads.getAttribute('data-id'), col: col });
  });
  socket.emit('clearLastRow', listAds);
}

function endGame() {
  socket.emit('stopRequest');
}

function handleDrop(e) {
  e.preventDefault();
  var dropElement = e.target;
  if (dragElement === dropElement) return false; // Do nothing
  dropElement.classList.remove('dragOver');
  socket.emit('requestSwapAds', { sourceId: dragElement.getAttribute('data-id'), targetId: dropElement.getAttribute('data-id') });
  return false;
}

document.addEventListener('keyup', function(e) {
  if (e.keyCode === 27) {
    endGame();
  }
});

document.addEventListener('dragstart', function (e) {
  dragElement = e.target;
  e.target.style.opacity = '0.5'; // Fade effect on dragElement
  e.dataTransfer.setData('text/html', e.target.innerHTML);
}, false);

document.addEventListener('dragend', function (e) {
  e.target.style.opacity = '1'; // Clear fade effect
}, false);

document.addEventListener('dragover', function (e) {
  e.preventDefault();
}, false);

document.addEventListener('dragenter', function (e) {
  e.stopPropagation();
  if (e.target === dragElement) return false; // Skip effect if hover on itself
  if (e.target.classList.contains('imageContainer')) e.target.classList.add('dragOver');
}, false);

document.addEventListener('dragleave', function (e) {
  e.stopPropagation();
  e.target.classList.remove('dragOver');
}, false);
