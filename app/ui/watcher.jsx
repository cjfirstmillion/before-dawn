import React from 'react';
import AttributesForm from './attributes-form';

(function() {
  const remote = window.require('electron').remote;
  const {ipcRenderer} = window.require('electron');
  const _ = require('lodash');

  const fs = require('fs');
  const path = require('path');
  const url = require('url');
  const exec = require('child_process').exec;
  var savers = remote.getGlobal('savers');

  var ReactDOM = require('react-dom');
  
  var OptionsForm = require('./options-form');

  // parse incoming URL params -- we'll get a link to the current screen images for previews here
  window.urlParams = window.location.search.split(/[?&]/).slice(1).map(function(paramPair) {
    return paramPair.split(/=(.+)?/).slice(0, 2);
  }).reduce(function (obj, pairArray) {            
    obj[pairArray[0]] = pairArray[1];
    return obj;
  }, {});


  console.log("PARAMS", window.urlParams);
  
  // the main app will pass us a screenshot URL, here it is
  var screenshot = decodeURIComponent(urlParams.screenshot);
  var src = decodeURIComponent(urlParams.src);

  // load screensaver object
  var s = savers.getByKey(src);
  var saverAttrs = s.toHash();
    
  var reloadPreview = function(ev) {
    var iframe = document.querySelector("iframe");

    var main = document.querySelector("#main");
    iframe.width = main.offsetWidth - 3;
    iframe.height = main.offsetHeight - 3;

    var url_opts = {
      width: iframe.width,
      height: iframe.height,
      screenshot: screenshot
    };

    var mergedOpts = _.merge(url_opts, s.settings);
    var previewUrl = s.getUrl(mergedOpts);

    console.log("LOAD URL", previewUrl);
    iframe.src = previewUrl;

    if ( typeof(ev) !== "undefined" ) {
      ev.preventDefault();
    }
  };

  var holder = document.getElementById("wrapper");
  var iframe = document.createElement('iframe');
  var saverOpts;

  var optionsUpdated = function(data) {
    saverOpts = data;
    reloadPreview();
  };
  
  var attrsUpdated = function(data) {
    console.log("ATTRS UPDATED", data);
    saverAttrs = data;
  };

  // do we need this?
  var optionsFormRef = ReactDOM.render(
    <OptionsForm saver={s} onChange={optionsUpdated} />,
    document.getElementById('options')
  );

  var attrFormRef = ReactDOM.render(
    <AttributesForm saver={saverAttrs} onChanged={attrsUpdated} />,
    document.getElementById('attributes')
  );
  
  holder.appendChild(iframe);

  reloadPreview();
  window.addEventListener('resize', reloadPreview, true);

  var filePath = path.dirname(url.parse(src).path);
  fs.watch(filePath, (eventType, filename) => {
    if (filename) {
      reloadPreview();
    }
  });

  // this is duped from new.html -- are we keeping that?
  var openFolderInOS = function(f) {
    var cmd;
    switch(process.platform) {
      case 'darwin':
        cmd = `open ${f}`;
        break;
      case 'win32':
        if (process.env.SystemRoot) {
          cmd = path.join(process.env.SystemRoot, 'explorer.exe');
        }
        else {
          cmd = 'explorer.exe';
        }

        cmd = cmd + ` /select,${f}`;
        break;
      default:
        // # Strip the filename from the path to make sure we pass a directory
        // # path. If we pass xdg-open a file path, it will open that file in the
        // # most suitable application instead, which is not what we want.
        cmd = `xdg-open ${f}`;
    };

    exec(cmd, function(error, stdout, stderr) {
      console.log('stdout: ' + stdout);
      console.log('stderr: ' + stderr);
      if (error !== null) {
        console.log('exec error: ' + error);
      }
    });
  };

  
  var openFolder = function(ev) {
    ev.preventDefault();
    openFolderInOS(filePath);
  };

  var closeWindow = function(ev) {
    var window = remote.getCurrentWindow();
    window.close();

    ev.preventDefault();
  };

  var saveSettings = function(ev) {
    ev.preventDefault();

    console.log("SAVE", saverAttrs);
    s.write(saverAttrs);
    ipcRenderer.send('savers-updated', s.key);
  };
  var openConsole = function(ev) {
    ev.preventDefault();
    remote.getCurrentWindow().toggleDevTools();
  };

  // we need to make sure the preview iframe is the right size
  // when we open that tab. this bit of jQuery handles that
  $('a[href="#main"]').on('shown.bs.tab', function (e) {
    reloadPreview();
  })
  
  
  document.querySelector(".open").addEventListener('click', openFolder, false);
  document.querySelector(".cancel").addEventListener('click', closeWindow, false);
  document.querySelector(".reload").addEventListener('click', reloadPreview, false);
  document.querySelector(".console").addEventListener('click', openConsole, false);
  
  var saveButtons = document.querySelectorAll(".save");

  for ( var i = 0; i < saveButtons.length; i++ ) {
    saveButtons[i].addEventListener('click', saveSettings, false);
  }

  
})();
