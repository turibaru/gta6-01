// Neon Bay — keyboard and mouse input, tracked per frame.
(function () {
  'use strict';
  var NB = window.NeonBay;

  function createInput(canvas) {
    var keys = {};
    var pressed = {};
    var mouse = { x: 0, y: 0, clicked: false, clickX: 0, clickY: 0 };
    var anyKey = false;

    function keyOf(e) {
      var k = e.key ? e.key.toLowerCase() : '';
      if (k === ' ') return 'space';
      if (k === 'arrowup') return 'up';
      if (k === 'arrowdown') return 'down';
      if (k === 'arrowleft') return 'left';
      if (k === 'arrowright') return 'right';
      return k;
    }

    window.addEventListener('keydown', function (e) {
      var k = keyOf(e);
      if (['up', 'down', 'left', 'right', 'space'].indexOf(k) >= 0) e.preventDefault();
      if (!keys[k]) pressed[k] = true;
      keys[k] = true;
      anyKey = true;
    });
    window.addEventListener('keyup', function (e) { keys[keyOf(e)] = false; });
    window.addEventListener('blur', function () {
      for (var k in keys) keys[k] = false;
    });
    canvas.addEventListener('mousemove', function (e) {
      var r = canvas.getBoundingClientRect();
      mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
      mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
    });
    canvas.addEventListener('click', function (e) {
      var r = canvas.getBoundingClientRect();
      mouse.clickX = (e.clientX - r.left) * (canvas.width / r.width);
      mouse.clickY = (e.clientY - r.top) * (canvas.height / r.height);
      mouse.clicked = true;
      anyKey = true;
    });

    return {
      keys: keys,
      pressed: pressed,
      mouse: mouse,
      isDown: function (name) { return !!keys[name]; },
      wasPressed: function (name) { return !!pressed[name]; },
      axis: function () {
        var x = 0, y = 0;
        if (keys.a || keys.left) x -= 1;
        if (keys.d || keys.right) x += 1;
        if (keys.w || keys.up) y -= 1;
        if (keys.s || keys.down) y += 1;
        return { x: x, y: y };
      },
      endFrame: function () {
        for (var k in pressed) pressed[k] = false;
        mouse.clicked = false;
        anyKey = false;
      },
      consumeAnyKey: function () { var v = anyKey; anyKey = false; return v; }
    };
  }

  NB.createInput = createInput;
})();
