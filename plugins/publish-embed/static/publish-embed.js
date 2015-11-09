/*jshint globalstrict:true */
/*jslint white:true */
/*global $, console, dw, require, window */

/*property
    __chartCacheDomain, ajax, backend, click, currentChart, delay, done, error,
    fadeIn, fadeOut, fail, get, getJSON, html, log, modal, preventDefault,
    replace, setTimeout, type, url
*/

'use strict';

require(['dw/chart/publish'], function () {
  $(function () {
    var action = $('.chart-actions .action-publish-embed');

    $('a', action).click(function (e) {
      e.preventDefault();
      showModal();
    });

    var showModal = function () {
      var chart = dw.backend.currentChart,
          chart_id = chart.get('id'),
          chart_url = 'http://' + dw.backend.__chartCacheDomain + '/' + chart_id + '/',
          w = chart.get('metadata.publish.embed-width'),
          h = chart.get('metadata.publish.embed-height'),
          titleChart = chart.get('title');

      $.get('/plugins/publish-embed/publish-embed.twig', function (data) {
        $('<div class="publish-chart-action-modal modal hide">' + data + '</div>').modal();

        publish_chart(function (err) {
          if (err) {
            throw err;
          }

          var textileCode = 'p(artHtml5). "[{{titleChart}}]":{{urlChart}}?w={{w}}&h={{h}}',
              htmlCode = '<iframe src="{{urlChart}}"  width="{{w}}" height="{{h}}" frameborder="0"  allowtransparency="true"  allowfullscreen="allowfullscreen" webkitallowfullscreen="webkitallowfullscreen" mozallowfullscreen="mozallowfullscreen" oallowfullscreen="oallowfullscreen" msallowfullscreen="msallowfullscreen"></iframe> ',
              urlCode = '{{urlChart}}';

          textileCode = textileCode.replace('{{urlChart}}', chart_url)
              .replace('{{titleChart}}', titleChart)
              .replace('{{w}}', w)
              .replace('{{h}}', h);
          htmlCode = htmlCode.replace('{{urlChart}}', chart_url)
              .replace('{{w}}', w)
              .replace('{{h}}', h);

          urlCode = urlCode.replace('{{urlChart}}', chart_url);

          $('.codes').delay(1000).fadeIn('fast');
          $('.loading').delay(1000).fadeOut('fast');

          $('textarea#textileArea').html(textileCode);
          $('textarea#htmlArea').html(htmlCode);
          $('textarea#urlArea').html(urlCode);
        });
      });

      function publish_chart(callback) {
        var pending = true;

        if (chart.get('publishedAt') && chart.get('publishedAt') > chart.get('lastModifiedAt')) {
          // no change since last publish
          return callback(null);
        }

        $.ajax({
          url: '/api/charts/' + chart_id + '/publish?local=1',
          type: 'post'
        }).done(function () {
          callback(null);
        }).fail(function () {
          console.error('failed');
          callback('publish failed');
          pending = false;
        });

        function checkStatus() {
          $.getJSON('/api/charts/' + chart_id + '/publish/status', function (ignore) {
            if (pending) {
              window.setTimeout(checkStatus, 300);
            }
          });
        }

        // in the meantime, check status periodically
        checkStatus();
      }
    };
  });
});
