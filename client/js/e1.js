(function() {
  'use strict';
  /* global jQuery: false, Backbone: false, _: false */
  var $ = jQuery;
  var sources;


  var TUMBLR_API_KEY = 'Wvz495Lkb0m1FGDNKUQJGzqv4Qgyt25UnZMISRB4e2CgmVJzEP';


  var githubURLExp = /github\.com/;
  var tumblrURLExp = /tumblr\.com/;
  var soundcloudURLExp = /soundcloud\.com/;

  function detectProvider(url) {
    if (githubURLExp.test(url)) { return 'github'; }
    if (tumblrURLExp.test(url)) { return 'tumblr'; }
    if (soundcloudURLExp.test(url)) { return 'soundcloud'; }
  }


  function debugEvents(obj, what) {
    obj.listenTo(obj[what], 'all', function(evName) {
      console.info(evName +' event on '+ what);
    });
  }




  var providers = {};
  var _githubRemaining = 60;
  var _githubReset;
  var _nextReset;

  var EventsList = Backbone.Collection.extend({
    initialize: function(models, options) {
      this.page = 0;
      this.source = options.source;
    },

    toEvents: function() {
      return this.map(function(model) {
        return model.toEvent();
      });
    }
  });

  var BaseModel = Backbone.Model.extend({
  });

  var GithubModel = BaseModel.extend({
    toEvent: function() {
      var obj = this.toJSON();
      return {
        source: this.collection.source.get('url'),
        provider: 'github',
        type: obj.type || 'unknown',
        date: new Date(obj.created_at),
        raw: obj
      };
    }
  });

  providers.github = EventsList.extend({
    initialize: function(models, options) {
      this.page = 1;
      this.source = options.source;
    },

    model: GithubModel,

    fetch: function(options) {
      var self = this;
      options = options || {};

      $.ajax({
        url: options.url,
        data: {
          page: self.page
        },
        success: (options.success ? options.success : function(data, textStatus, jqXhr) {
          self.add(data);
          self.page = self.page + 1;

          _githubRemaining = parseInt(jqXhr.getResponseHeader('X-RateLimit-Remaining'), 10);
          _githubReset = parseInt(jqXhr.getResponseHeader('X-RateLimit-Reset'), 10);
          _nextReset = (new Date(_githubReset * 1000)) - (new Date());

          // if (self.page !== false) {
          //   setTimeout(function() {
          //     self.fetch(options);
          //   }, 5000);
          // }
        }),
        error: function() {
          self.page = false;
        }
      });
    }
  });


  var TumblrModel = BaseModel.extend({
    toEvent: function() {
      var obj = this.toJSON();
      return {
        source: this.collection.source.get('url'),
        provider: 'tumblr',
        type: obj.type || 'unknown',
        date: new Date(obj.date),
        raw: obj
      };
    }
  });

  providers.tumblr = EventsList.extend({
    model: TumblrModel,

    fetch: function(options) {
      var self = this;
      options = options || {};

      $.ajax({
        url: options.url,
        data: {
          offset: 20 * self.page,
          api_key: TUMBLR_API_KEY
        },
        dataType: 'jsonp',
        success: function(data) {
          self.add(data.response.posts || data.response.liked_posts || data.response.users || []);
          self.page = self.page + 1;

          // if (self.page !== false) {
          //   setTimeout(function() {
          //     self.fetch(options);
          //   }, 5000);
          // }
        },
        error: function() {
          self.page = false;
        }
      });
    }
  });




  providers.soundcloud = EventsList.extend({
    fetch: function(options) {
      options = options || {};
    }
  });



  var Source = BaseModel.extend({
    // idAttribute: 'url',

    initialize: function(attrs) {
      var provider = attrs.provider || detectProvider(attrs.url);

      var List = providers[provider];
      if (!_.isFunction(List)) {
        return;
      }

      this.events = new List([], {
        source: this
      });

      this.fetchEvents();
    },

    fetchEvents: function() {
      this.events.fetch({
        url: this.get('url')
      });
    }
  });

  var Sources = Backbone.Collection.extend({
    model: Source
  });

  sources = new Sources();











  var _templates = {};
  function template(name) {
    if (!_templates[name]) {
      var tpl = $.trim($('script[name="'+ name +'"]').html());
      tpl = tpl || 'No template for '+ name;
      _templates[name] = _.template(tpl);
    }
    return _templates[name];
  }



  var BaseView = Backbone.View.extend({
    subView: function(model, Constructor) {
      this._subViews = this._subViews || {};
      if (!this._subViews[model.cid]) {
        this._subViews[model.cid] = (new Constructor({
          model: model
        }));
      }
      return this._subViews[model.cid];
    }
  });




  var SourceView = BaseView.extend({
    tagName: 'li',
    className: 'panel panel-default',
    initialize: function(options) {
      var model = options.model;
      this.model = model;
      this.sound = new SourceSound(options);

      _.each(jsfx.getParameters(), function(param) {
        if (!model.has(param.id)) {
          var val = param.type === 'range' ? parseFloat(param.def, 10) : param.def;
          model.set(param.id, val, {
            silent: true
          });
        }
      });

      debugEvents(this, 'model');

      this.tmpl = template('source');

      this.listenTo(this.model, 'change', this.update);
      this.listenTo(this.model.events, 'add', this.render);
      this.listenTo(this.model, 'change:url', this.render);

      this.render();
    },

    events: {
      'click .mute': 'mute',
      'change input[type="range"]': 'change',
      'change select': 'change'
    },


    change: function(ev) {
      var $target = $(ev.target);
      var update = {};
      var val = $target.val();
      if ($target.attr('type') === 'range') {
        val = parseFloat(val, 10);
      }
      update[$target.attr('name')] = val;
      this.model.set(update);
      this
        .sound
        // .render()
        .play();
    },


    update: function() {
      return this;
    },


    render: function() {

      this.$el.html(this.tmpl(_.extend(this.model.toJSON(), {
        events: this.model.events.toEvents(),
        parameters: jsfx.getParameters(),
        generators: jsfx.getGeneratorNames()
      })));

      return this;
    }
  });

  var SourceSound = BaseView.extend({
    initialize: function(options) {
      this.model = options.model;
      this.listenTo(this.model, 'change', this.render);
    },

    render: function(options) {
      options = options || {};
      var data = jsfx.generate(this.model.toJSON());
      if(typeof this.wave !== 'undefined') {
        delete this.wave;
      }

      this.wave = audio.make(data);

      if (options.silent) {
        return this;
      }
      return this;
    },

    play: function() {
      this.wave.play();
      return this;
    }
  }, {
    blank: function() {
      return [
        0.0000,
        0.0000,
        0.0000,
        0.0000,
        0.0000,
        0.0000,
        0.0000,
        0.0000,
        0.0000,
        0.0000,
        0.0000,
        0.0000,
        0.0000,
        0.0000,
        0.0000,
        0.0000,
        0.0000,
        0.0000,
        0.0000,
        0.0000,
        0.0000,
        0.0000,
        0.0000,
        0.0000,
        0.0000,
        0.0000,
        0.0000
      ].slice(0);
    }
  });



  var EventModel = BaseModel.extend({
    idAttribute: 'date',
    defaults: {
      source: 'unknown',
      provider: 'unknown',
      type: 'unknown',
      date: function() { return new Date(); }
    }
  });

  var FlattenEventsList = Backbone.Collection.extend({
    comparator: 'date',
    model: EventModel
  });


  function getRandomColor() {
    var letters = '0123456789ABCDEF'.split('');
    var color = '#';
    for (var i = 0; i < 6; i++ ) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  }

  var AllSourceEventsView = BaseView.extend({
    sourceColors: {},

    initialize: function(options) {
      var self = this;
      this.tmpl = template('all-source-events');

      this.collection = options.collection;

      this.flatten = new FlattenEventsList();

      this.listenTo(this.collection, 'add', function(source) {
        if (!source.has('color')) {
          var bg = getRandomColor();

          var text = Colour(bg);
          var luma = text.luma();
          text = text.desaturate().invert();
          if (luma < 0.5) {
            text = text.lighten(0.5).toString();
          }
          else {
            text = text.darken(0.5).toString();
          }

          source.set({
            color: text,
            background: bg
          }, {
            silent: true
          });
        }

        self.listenTo(source.events, 'add', function(event) {
          self.flatten.add(_.extend(event.toEvent(), {
            color: source.get('color'),
            background: source.get('background')
          }));
        });

        self.listenTo(source.events, 'remove', function(event) {
          self.flatten.remove(event.toEvent());
        });
      });

      this.listenTo(this.collection, 'remove', function(source) {
        self.stopListening(source.events);
        // ... flatten?
      });

      this.listenTo(this.flatten, 'add remove', this.render);
    },

    render: function() {
      this.undelegateEvents();

      var dates = {};
      this.flatten.each(function(model) {
        // var date = model.get('date');
        var date = moment(model.get('date'));
        var obj = model.toJSON();
        delete obj.raw;

        // var year = date.getFullYear();
        // var month = date.getMonth() + 1;
        // var day = date.getDate();
        // var hour = date.getHours();

        var year = date.format('YYYY');
        var month = date.format('MMM');
        var day = date.format('dd D');
        var hour = date.format('H');

        dates[year] = dates[year] || {};
        dates[year][month] = dates[year][month] || {};
        dates[year][month][day] = dates[year][month][day] || {};
        dates[year][month][day][hour] = dates[year][month][day][hour] || [];
        dates[year][month][day][hour].push(obj);
      });

      var events = this.flatten.toJSON();
      this.$el.html(this.tmpl({
        dates: dates,
        events: events
      }));

      this.delegateEvents();

      return this;
    }
  });




  var SourcesView = BaseView.extend({
    initialize: function() {
      // debugEvents(this, 'collection');

      this.tmpl = template('sources');
      this.listenTo(this.collection, 'add', this.render);
      this.render();
    },

    events: {
      'keyup [name="new-source"]': 'detect',
      'click [name="add-source"]': 'add',
      'change [name="source-type"]': 'changeProvider',
      'click [name="play"]': 'play',
      'submit form': 'add'
    },

    play: function() {

    },

    detect: function() {
      var url = this.$('[name="new-source"]').val();
      this.$('[name="source-type"]').val(detectProvider(url));
    },

    changeProvider: function() {
      var provider = this.$('[name="source-type"]').val();
      this.$('[name="new-source"]').attr('placeholder', {
        github: 'A github user name',
        tumblr: 'A tumblr blog',
        soundcloud: 'A soundcloud user name',
        '': 'A URL.. no guarantee...'
      }[''+ provider]);
   },

    add: function() {
      var name = this.$('[name="new-source"]').val();
      var url = name;
      var provider = this.$('[name="source-type"]').val();

      if (provider === 'github') {
        url = 'https://api.github.com/users/'+ name +'/events';
      }
      else if (provider === 'tumblr') {
        url = 'http://api.tumblr.com/v2/blog/'+ name +'/posts';
      }
      else if (provider === 'soundcloud') {
        // ...
      }


      var source = new Source({
        provider: provider,
        name: name,
        url: url
      }, {
        collection: this.collection
      });
      this.collection.add(source);
      // source.fetch();
    },

    update: function() {
      return this;
    },

    render: function() {
      var self = this;
      this.undelegateEvents();

      this.$el.html(this.tmpl(this.collection.toJSON()));

      var $list = this.$('ol.sources');
      this.collection.each(function(model) {
        $list.append(self.subView(model, SourceView).el);
      });

      this.delegateEvents();
      return this;
    }
  });

  var sourcesView = new SourcesView({
    collection: sources
  });

  var allSourceEventsView = new AllSourceEventsView({
    collection: sources
  });

  $(function() {
    $('body')
      .prepend(allSourceEventsView.$el.addClass('container-fluid'))
      .prepend(sourcesView.$el.addClass('container-fluid'))
    ;

    sources.add([
      {
        url: 'http://api.tumblr.com/v2/blog/zeropaper.tumblr.com/likes'
      },
      {
        url: 'https://api.github.com/users/zeropaper/events'
      }
    ]);
  });

}());
