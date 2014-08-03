(function() {
  'use strict';
  /* global jQuery: false, Backbone: false, _: false */
  var $ = jQuery;

  function getTumblrPosts(blogname, done) {
    $.getJSON('http://'+ blogname +'.tumblr.com/api/read/json?callback=?', function(data) {
      done(null, data.posts);
    });
  }


  var EventsList = Backbone.Collection.extend({
    model: Backbone.Model.extend({
      defaults: {

      }
    })
  });

  var Sources = Backbone.Collection.extend({
    model: Backbone.Model.extend({
      defaults: {
        url: '',
        type: 'json'
      },
      initialize: function() {
        this.events = new EventsList([], {
          source: this
        });
      }
    })
  });

  var sources = new Sources();

  var eventsList = new EventsList();

}());