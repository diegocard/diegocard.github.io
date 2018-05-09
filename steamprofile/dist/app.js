
/*  Prototype JavaScript framework, version 1.7
 *  (c) 2005-2010 Sam Stephenson
 *
 *  Prototype is freely distributable under the terms of an MIT-style license.
 *  For details, see the Prototype web site: http://www.prototypejs.org/
 *
 *--------------------------------------------------------------------------*/

var Prototype = {

  Version: '1.7',

  Browser: (function(){
    var ua = navigator.userAgent;
    var isOpera = Object.prototype.toString.call(window.opera) == '[object Opera]';
    return {
      IE:             !!window.attachEvent && !isOpera,
      Opera:          isOpera,
      WebKit:         ua.indexOf('AppleWebKit/') > -1,
      Gecko:          ua.indexOf('Gecko') > -1 && ua.indexOf('KHTML') === -1,
      MobileSafari:   /Apple.*Mobile/.test(ua)
    }
  })(),

  BrowserFeatures: {
    XPath: !!document.evaluate,

    SelectorsAPI: !!document.querySelector,

    ElementExtensions: (function() {
      var constructor = window.Element || window.HTMLElement;
      return !!(constructor && constructor.prototype);
    })(),
    SpecificElementExtensions: (function() {
      if (typeof window.HTMLDivElement !== 'undefined')
        return true;

      var div = document.createElement('div'),
          form = document.createElement('form'),
          isSupported = false;

      if (div['__proto__'] && (div['__proto__'] !== form['__proto__'])) {
        isSupported = true;
      }

      div = form = null;

      return isSupported;
    })()
  },

  ScriptFragment: '<script[^>]*>([\\S\\s]*?)<\/script>',
  JSONFilter: /^\/\*-secure-([\s\S]*)\*\/\s*$/,

  emptyFunction: function() { },

  K: function(x) { return x }
};

if (Prototype.Browser.MobileSafari)
  Prototype.BrowserFeatures.SpecificElementExtensions = false;


var Abstract = { };


var Try = {
  these: function() {
    var returnValue;

    for (var i = 0, length = arguments.length; i < length; i++) {
      var lambda = arguments[i];
      try {
        returnValue = lambda();
        break;
      } catch (e) { }
    }

    return returnValue;
  }
};

/* Based on Alex Arnell's inheritance implementation. */

var Class = (function() {

  var IS_DONTENUM_BUGGY = (function(){
    for (var p in { toString: 1 }) {
      if (p === 'toString') return false;
    }
    return true;
  })();

  function subclass() {};
  function create() {
    var parent = null, properties = $A(arguments);
    if (Object.isFunction(properties[0]))
      parent = properties.shift();

    function klass() {
      this.initialize.apply(this, arguments);
    }

    Object.extend(klass, Class.Methods);
    klass.superclass = parent;
    klass.subclasses = [];

    if (parent) {
      subclass.prototype = parent.prototype;
      klass.prototype = new subclass;
      parent.subclasses.push(klass);
    }

    for (var i = 0, length = properties.length; i < length; i++)
      klass.addMethods(properties[i]);

    if (!klass.prototype.initialize)
      klass.prototype.initialize = Prototype.emptyFunction;

    klass.prototype.constructor = klass;
    return klass;
  }

  function addMethods(source) {
    var ancestor   = this.superclass && this.superclass.prototype,
        properties = Object.keys(source);

    if (IS_DONTENUM_BUGGY) {
      if (source.toString != Object.prototype.toString)
        properties.push("toString");
      if (source.valueOf != Object.prototype.valueOf)
        properties.push("valueOf");
    }

    for (var i = 0, length = properties.length; i < length; i++) {
      var property = properties[i], value = source[property];
      if (ancestor && Object.isFunction(value) &&
          value.argumentNames()[0] == "$super") {
        var method = value;
        value = (function(m) {
          return function() { return ancestor[m].apply(this, arguments); };
        })(property).wrap(method);

        value.valueOf = method.valueOf.bind(method);
        value.toString = method.toString.bind(method);
      }
      this.prototype[property] = value;
    }

    return this;
  }

  return {
    create: create,
    Methods: {
      addMethods: addMethods
    }
  };
})();
(function() {

  var _toString = Object.prototype.toString,
      NULL_TYPE = 'Null',
      UNDEFINED_TYPE = 'Undefined',
      BOOLEAN_TYPE = 'Boolean',
      NUMBER_TYPE = 'Number',
      STRING_TYPE = 'String',
      OBJECT_TYPE = 'Object',
      FUNCTION_CLASS = '[object Function]',
      BOOLEAN_CLASS = '[object Boolean]',
      NUMBER_CLASS = '[object Number]',
      STRING_CLASS = '[object String]',
      ARRAY_CLASS = '[object Array]',
      DATE_CLASS = '[object Date]',
      NATIVE_JSON_STRINGIFY_SUPPORT = window.JSON &&
        typeof JSON.stringify === 'function' &&
        JSON.stringify(0) === '0' &&
        typeof JSON.stringify(Prototype.K) === 'undefined';

  function Type(o) {
    switch(o) {
      case null: return NULL_TYPE;
      case (void 0): return UNDEFINED_TYPE;
    }
    var type = typeof o;
    switch(type) {
      case 'boolean': return BOOLEAN_TYPE;
      case 'number':  return NUMBER_TYPE;
      case 'string':  return STRING_TYPE;
    }
    return OBJECT_TYPE;
  }

  function extend(destination, source) {
    for (var property in source)
      destination[property] = source[property];
    return destination;
  }

  function inspect(object) {
    try {
      if (isUndefined(object)) return 'undefined';
      if (object === null) return 'null';
      return object.inspect ? object.inspect() : String(object);
    } catch (e) {
      if (e instanceof RangeError) return '...';
      throw e;
    }
  }

  function toJSON(value) {
    return Str('', { '': value }, []);
  }

  function Str(key, holder, stack) {
    var value = holder[key],
        type = typeof value;

    if (Type(value) === OBJECT_TYPE && typeof value.toJSON === 'function') {
      value = value.toJSON(key);
    }

    var _class = _toString.call(value);

    switch (_class) {
      case NUMBER_CLASS:
      case BOOLEAN_CLASS:
      case STRING_CLASS:
        value = value.valueOf();
    }

    switch (value) {
      case null: return 'null';
      case true: return 'true';
      case false: return 'false';
    }

    type = typeof value;
    switch (type) {
      case 'string':
        return value.inspect(true);
      case 'number':
        return isFinite(value) ? String(value) : 'null';
      case 'object':

        for (var i = 0, length = stack.length; i < length; i++) {
          if (stack[i] === value) { throw new TypeError(); }
        }
        stack.push(value);

        var partial = [];
        if (_class === ARRAY_CLASS) {
          for (var i = 0, length = value.length; i < length; i++) {
            var str = Str(i, value, stack);
            partial.push(typeof str === 'undefined' ? 'null' : str);
          }
          partial = '[' + partial.join(',') + ']';
        } else {
          var keys = Object.keys(value);
          for (var i = 0, length = keys.length; i < length; i++) {
            var key = keys[i], str = Str(key, value, stack);
            if (typeof str !== "undefined") {
               partial.push(key.inspect(true)+ ':' + str);
             }
          }
          partial = '{' + partial.join(',') + '}';
        }
        stack.pop();
        return partial;
    }
  }

  function stringify(object) {
    return JSON.stringify(object);
  }

  function toQueryString(object) {
    return $H(object).toQueryString();
  }

  function toHTML(object) {
    return object && object.toHTML ? object.toHTML() : String.interpret(object);
  }

  function keys(object) {
    if (Type(object) !== OBJECT_TYPE) { throw new TypeError(); }
    var results = [];
    for (var property in object) {
      if (object.hasOwnProperty(property)) {
        results.push(property);
      }
    }
    return results;
  }

  function values(object) {
    var results = [];
    for (var property in object)
      results.push(object[property]);
    return results;
  }

  function clone(object) {
    return extend({ }, object);
  }

  function isElement(object) {
    return !!(object && object.nodeType == 1);
  }

  function isArray(object) {
    return _toString.call(object) === ARRAY_CLASS;
  }

  var hasNativeIsArray = (typeof Array.isArray == 'function')
    && Array.isArray([]) && !Array.isArray({});

  if (hasNativeIsArray) {
    isArray = Array.isArray;
  }

  function isHash(object) {
    return object instanceof Hash;
  }

  function isFunction(object) {
    return _toString.call(object) === FUNCTION_CLASS;
  }

  function isString(object) {
    return _toString.call(object) === STRING_CLASS;
  }

  function isNumber(object) {
    return _toString.call(object) === NUMBER_CLASS;
  }

  function isDate(object) {
    return _toString.call(object) === DATE_CLASS;
  }

  function isUndefined(object) {
    return typeof object === "undefined";
  }

  extend(Object, {
    extend:        extend,
    inspect:       inspect,
    toJSON:        NATIVE_JSON_STRINGIFY_SUPPORT ? stringify : toJSON,
    toQueryString: toQueryString,
    toHTML:        toHTML,
    keys:          Object.keys || keys,
    values:        values,
    clone:         clone,
    isElement:     isElement,
    isArray:       isArray,
    isHash:        isHash,
    isFunction:    isFunction,
    isString:      isString,
    isNumber:      isNumber,
    isDate:        isDate,
    isUndefined:   isUndefined
  });
})();
Object.extend(Function.prototype, (function() {
  var slice = Array.prototype.slice;

  function update(array, args) {
    var arrayLength = array.length, length = args.length;
    while (length--) array[arrayLength + length] = args[length];
    return array;
  }

  function merge(array, args) {
    array = slice.call(array, 0);
    return update(array, args);
  }

  function argumentNames() {
    var names = this.toString().match(/^[\s\(]*function[^(]*\(([^)]*)\)/)[1]
      .replace(/\/\/.*?[\r\n]|\/\*(?:.|[\r\n])*?\*\//g, '')
      .replace(/\s+/g, '').split(',');
    return names.length == 1 && !names[0] ? [] : names;
  }

  function bind(context) {
    if (arguments.length < 2 && Object.isUndefined(arguments[0])) return this;
    var __method = this, args = slice.call(arguments, 1);
    return function() {
      var a = merge(args, arguments);
      return __method.apply(context, a);
    }
  }

  function bindAsEventListener(context) {
    var __method = this, args = slice.call(arguments, 1);
    return function(event) {
      var a = update([event || window.event], args);
      return __method.apply(context, a);
    }
  }

  function curry() {
    if (!arguments.length) return this;
    var __method = this, args = slice.call(arguments, 0);
    return function() {
      var a = merge(args, arguments);
      return __method.apply(this, a);
    }
  }

  function delay(timeout) {
    var __method = this, args = slice.call(arguments, 1);
    timeout = timeout * 1000;
    return window.setTimeout(function() {
      return __method.apply(__method, args);
    }, timeout);
  }

  function defer() {
    var args = update([0.01], arguments);
    return this.delay.apply(this, args);
  }

  function wrap(wrapper) {
    var __method = this;
    return function() {
      var a = update([__method.bind(this)], arguments);
      return wrapper.apply(this, a);
    }
  }

  function methodize() {
    if (this._methodized) return this._methodized;
    var __method = this;
    return this._methodized = function() {
      var a = update([this], arguments);
      return __method.apply(null, a);
    };
  }

  return {
    argumentNames:       argumentNames,
    bind:                bind,
    bindAsEventListener: bindAsEventListener,
    curry:               curry,
    delay:               delay,
    defer:               defer,
    wrap:                wrap,
    methodize:           methodize
  }
})());



(function(proto) {


  function toISOString() {
    return this.getUTCFullYear() + '-' +
      (this.getUTCMonth() + 1).toPaddedString(2) + '-' +
      this.getUTCDate().toPaddedString(2) + 'T' +
      this.getUTCHours().toPaddedString(2) + ':' +
      this.getUTCMinutes().toPaddedString(2) + ':' +
      this.getUTCSeconds().toPaddedString(2) + 'Z';
  }


  function toJSON() {
    return this.toISOString();
  }

  if (!proto.toISOString) proto.toISOString = toISOString;
  if (!proto.toJSON) proto.toJSON = toJSON;

})(Date.prototype);


RegExp.prototype.match = RegExp.prototype.test;

RegExp.escape = function(str) {
  return String(str).replace(/([.*+?^=!:${}()|[\]\/\\])/g, '\\$1');
};
var PeriodicalExecuter = Class.create({
  initialize: function(callback, frequency) {
    this.callback = callback;
    this.frequency = frequency;
    this.currentlyExecuting = false;

    this.registerCallback();
  },

  registerCallback: function() {
    this.timer = setInterval(this.onTimerEvent.bind(this), this.frequency * 1000);
  },

  execute: function() {
    this.callback(this);
  },

  stop: function() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  },

  onTimerEvent: function() {
    if (!this.currentlyExecuting) {
      try {
        this.currentlyExecuting = true;
        this.execute();
        this.currentlyExecuting = false;
      } catch(e) {
        this.currentlyExecuting = false;
        throw e;
      }
    }
  }
});
Object.extend(String, {
  interpret: function(value) {
    return value == null ? '' : String(value);
  },
  specialChar: {
    '\b': '\\b',
    '\t': '\\t',
    '\n': '\\n',
    '\f': '\\f',
    '\r': '\\r',
    '\\': '\\\\'
  }
});

Object.extend(String.prototype, (function() {
  var NATIVE_JSON_PARSE_SUPPORT = window.JSON &&
    typeof JSON.parse === 'function' &&
    JSON.parse('{"test": true}').test;

  function prepareReplacement(replacement) {
    if (Object.isFunction(replacement)) return replacement;
    var template = new Template(replacement);
    return function(match) { return template.evaluate(match) };
  }

  function gsub(pattern, replacement) {
    var result = '', source = this, match;
    replacement = prepareReplacement(replacement);

    if (Object.isString(pattern))
      pattern = RegExp.escape(pattern);

    if (!(pattern.length || pattern.source)) {
      replacement = replacement('');
      return replacement + source.split('').join(replacement) + replacement;
    }

    while (source.length > 0) {
      if (match = source.match(pattern)) {
        result += source.slice(0, match.index);
        result += String.interpret(replacement(match));
        source  = source.slice(match.index + match[0].length);
      } else {
        result += source, source = '';
      }
    }
    return result;
  }

  function sub(pattern, replacement, count) {
    replacement = prepareReplacement(replacement);
    count = Object.isUndefined(count) ? 1 : count;

    return this.gsub(pattern, function(match) {
      if (--count < 0) return match[0];
      return replacement(match);
    });
  }

  function scan(pattern, iterator) {
    this.gsub(pattern, iterator);
    return String(this);
  }

  function truncate(length, truncation) {
    length = length || 30;
    truncation = Object.isUndefined(truncation) ? '...' : truncation;
    return this.length > length ?
      this.slice(0, length - truncation.length) + truncation : String(this);
  }

  function strip() {
    return this.replace(/^\s+/, '').replace(/\s+$/, '');
  }

  function stripTags() {
    return this.replace(/<\w+(\s+("[^"]*"|'[^']*'|[^>])+)?>|<\/\w+>/gi, '');
  }

  function stripScripts() {
    return this.replace(new RegExp(Prototype.ScriptFragment, 'img'), '');
  }

  function extractScripts() {
    var matchAll = new RegExp(Prototype.ScriptFragment, 'img'),
        matchOne = new RegExp(Prototype.ScriptFragment, 'im');
    return (this.match(matchAll) || []).map(function(scriptTag) {
      return (scriptTag.match(matchOne) || ['', ''])[1];
    });
  }

  function evalScripts() {
    return this.extractScripts().map(function(script) { return eval(script) });
  }

  function escapeHTML() {
    return this.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function unescapeHTML() {
    return this.stripTags().replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
  }


  function toQueryParams(separator) {
    var match = this.strip().match(/([^?#]*)(#.*)?$/);
    if (!match) return { };

    return match[1].split(separator || '&').inject({ }, function(hash, pair) {
      if ((pair = pair.split('='))[0]) {
        var key = decodeURIComponent(pair.shift()),
            value = pair.length > 1 ? pair.join('=') : pair[0];

        if (value != undefined) value = decodeURIComponent(value);

        if (key in hash) {
          if (!Object.isArray(hash[key])) hash[key] = [hash[key]];
          hash[key].push(value);
        }
        else hash[key] = value;
      }
      return hash;
    });
  }

  function toArray() {
    return this.split('');
  }

  function succ() {
    return this.slice(0, this.length - 1) +
      String.fromCharCode(this.charCodeAt(this.length - 1) + 1);
  }

  function times(count) {
    return count < 1 ? '' : new Array(count + 1).join(this);
  }

  function camelize() {
    return this.replace(/-+(.)?/g, function(match, chr) {
      return chr ? chr.toUpperCase() : '';
    });
  }

  function capitalize() {
    return this.charAt(0).toUpperCase() + this.substring(1).toLowerCase();
  }

  function underscore() {
    return this.replace(/::/g, '/')
               .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
               .replace(/([a-z\d])([A-Z])/g, '$1_$2')
               .replace(/-/g, '_')
               .toLowerCase();
  }

  function dasherize() {
    return this.replace(/_/g, '-');
  }

  function inspect(useDoubleQuotes) {
    var escapedString = this.replace(/[\x00-\x1f\\]/g, function(character) {
      if (character in String.specialChar) {
        return String.specialChar[character];
      }
      return '\\u00' + character.charCodeAt().toPaddedString(2, 16);
    });
    if (useDoubleQuotes) return '"' + escapedString.replace(/"/g, '\\"') + '"';
    return "'" + escapedString.replace(/'/g, '\\\'') + "'";
  }

  function unfilterJSON(filter) {
    return this.replace(filter || Prototype.JSONFilter, '$1');
  }

  function isJSON() {
    var str = this;
    if (str.blank()) return false;
    str = str.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@');
    str = str.replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']');
    str = str.replace(/(?:^|:|,)(?:\s*\[)+/g, '');
    return (/^[\],:{}\s]*$/).test(str);
  }

  function evalJSON(sanitize) {
    var json = this.unfilterJSON(),
        cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
    if (cx.test(json)) {
      json = json.replace(cx, function (a) {
        return '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
      });
    }
    try {
      if (!sanitize || json.isJSON()) return eval('(' + json + ')');
    } catch (e) { }
    throw new SyntaxError('Badly formed JSON string: ' + this.inspect());
  }

  function parseJSON() {
    var json = this.unfilterJSON();
    return JSON.parse(json);
  }

  function include(pattern) {
    return this.indexOf(pattern) > -1;
  }

  function startsWith(pattern) {
    return this.lastIndexOf(pattern, 0) === 0;
  }

  function endsWith(pattern) {
    var d = this.length - pattern.length;
    return d >= 0 && this.indexOf(pattern, d) === d;
  }

  function empty() {
    return this == '';
  }

  function blank() {
    return /^\s*$/.test(this);
  }

  function interpolate(object, pattern) {
    return new Template(this, pattern).evaluate(object);
  }

  return {
    gsub:           gsub,
    sub:            sub,
    scan:           scan,
    truncate:       truncate,
    strip:          String.prototype.trim || strip,
    stripTags:      stripTags,
    stripScripts:   stripScripts,
    extractScripts: extractScripts,
    evalScripts:    evalScripts,
    escapeHTML:     escapeHTML,
    unescapeHTML:   unescapeHTML,
    toQueryParams:  toQueryParams,
    parseQuery:     toQueryParams,
    toArray:        toArray,
    succ:           succ,
    times:          times,
    camelize:       camelize,
    capitalize:     capitalize,
    underscore:     underscore,
    dasherize:      dasherize,
    inspect:        inspect,
    unfilterJSON:   unfilterJSON,
    isJSON:         isJSON,
    evalJSON:       NATIVE_JSON_PARSE_SUPPORT ? parseJSON : evalJSON,
    include:        include,
    startsWith:     startsWith,
    endsWith:       endsWith,
    empty:          empty,
    blank:          blank,
    interpolate:    interpolate
  };
})());

var Template = Class.create({
  initialize: function(template, pattern) {
    this.template = template.toString();
    this.pattern = pattern || Template.Pattern;
  },

  evaluate: function(object) {
    if (object && Object.isFunction(object.toTemplateReplacements))
      object = object.toTemplateReplacements();

    return this.template.gsub(this.pattern, function(match) {
      if (object == null) return (match[1] + '');

      var before = match[1] || '';
      if (before == '\\') return match[2];

      var ctx = object, expr = match[3],
          pattern = /^([^.[]+|\[((?:.*?[^\\])?)\])(\.|\[|$)/;

      match = pattern.exec(expr);
      if (match == null) return before;

      while (match != null) {
        var comp = match[1].startsWith('[') ? match[2].replace(/\\\\]/g, ']') : match[1];
        ctx = ctx[comp];
        if (null == ctx || '' == match[3]) break;
        expr = expr.substring('[' == match[3] ? match[1].length : match[0].length);
        match = pattern.exec(expr);
      }

      return before + String.interpret(ctx);
    });
  }
});
Template.Pattern = /(^|.|\r|\n)(#\{(.*?)\})/;

var $break = { };

var Enumerable = (function() {
  function each(iterator, context) {
    var index = 0;
    try {
      this._each(function(value) {
        iterator.call(context, value, index++);
      });
    } catch (e) {
      if (e != $break) throw e;
    }
    return this;
  }

  function eachSlice(number, iterator, context) {
    var index = -number, slices = [], array = this.toArray();
    if (number < 1) return array;
    while ((index += number) < array.length)
      slices.push(array.slice(index, index+number));
    return slices.collect(iterator, context);
  }

  function all(iterator, context) {
    iterator = iterator || Prototype.K;
    var result = true;
    this.each(function(value, index) {
      result = result && !!iterator.call(context, value, index);
      if (!result) throw $break;
    });
    return result;
  }

  function any(iterator, context) {
    iterator = iterator || Prototype.K;
    var result = false;
    this.each(function(value, index) {
      if (result = !!iterator.call(context, value, index))
        throw $break;
    });
    return result;
  }

  function collect(iterator, context) {
    iterator = iterator || Prototype.K;
    var results = [];
    this.each(function(value, index) {
      results.push(iterator.call(context, value, index));
    });
    return results;
  }

  function detect(iterator, context) {
    var result;
    this.each(function(value, index) {
      if (iterator.call(context, value, index)) {
        result = value;
        throw $break;
      }
    });
    return result;
  }

  function findAll(iterator, context) {
    var results = [];
    this.each(function(value, index) {
      if (iterator.call(context, value, index))
        results.push(value);
    });
    return results;
  }

  function grep(filter, iterator, context) {
    iterator = iterator || Prototype.K;
    var results = [];

    if (Object.isString(filter))
      filter = new RegExp(RegExp.escape(filter));

    this.each(function(value, index) {
      if (filter.match(value))
        results.push(iterator.call(context, value, index));
    });
    return results;
  }

  function include(object) {
    if (Object.isFunction(this.indexOf))
      if (this.indexOf(object) != -1) return true;

    var found = false;
    this.each(function(value) {
      if (value == object) {
        found = true;
        throw $break;
      }
    });
    return found;
  }

  function inGroupsOf(number, fillWith) {
    fillWith = Object.isUndefined(fillWith) ? null : fillWith;
    return this.eachSlice(number, function(slice) {
      while(slice.length < number) slice.push(fillWith);
      return slice;
    });
  }

  function inject(memo, iterator, context) {
    this.each(function(value, index) {
      memo = iterator.call(context, memo, value, index);
    });
    return memo;
  }

  function invoke(method) {
    var args = $A(arguments).slice(1);
    return this.map(function(value) {
      return value[method].apply(value, args);
    });
  }

  function max(iterator, context) {
    iterator = iterator || Prototype.K;
    var result;
    this.each(function(value, index) {
      value = iterator.call(context, value, index);
      if (result == null || value >= result)
        result = value;
    });
    return result;
  }

  function min(iterator, context) {
    iterator = iterator || Prototype.K;
    var result;
    this.each(function(value, index) {
      value = iterator.call(context, value, index);
      if (result == null || value < result)
        result = value;
    });
    return result;
  }

  function partition(iterator, context) {
    iterator = iterator || Prototype.K;
    var trues = [], falses = [];
    this.each(function(value, index) {
      (iterator.call(context, value, index) ?
        trues : falses).push(value);
    });
    return [trues, falses];
  }

  function pluck(property) {
    var results = [];
    this.each(function(value) {
      results.push(value[property]);
    });
    return results;
  }

  function reject(iterator, context) {
    var results = [];
    this.each(function(value, index) {
      if (!iterator.call(context, value, index))
        results.push(value);
    });
    return results;
  }

  function sortBy(iterator, context) {
    return this.map(function(value, index) {
      return {
        value: value,
        criteria: iterator.call(context, value, index)
      };
    }).sort(function(left, right) {
      var a = left.criteria, b = right.criteria;
      return a < b ? -1 : a > b ? 1 : 0;
    }).pluck('value');
  }

  function toArray() {
    return this.map();
  }

  function zip() {
    var iterator = Prototype.K, args = $A(arguments);
    if (Object.isFunction(args.last()))
      iterator = args.pop();

    var collections = [this].concat(args).map($A);
    return this.map(function(value, index) {
      return iterator(collections.pluck(index));
    });
  }

  function size() {
    return this.toArray().length;
  }

  function inspect() {
    return '#<Enumerable:' + this.toArray().inspect() + '>';
  }









  return {
    each:       each,
    eachSlice:  eachSlice,
    all:        all,
    every:      all,
    any:        any,
    some:       any,
    collect:    collect,
    map:        collect,
    detect:     detect,
    findAll:    findAll,
    select:     findAll,
    filter:     findAll,
    grep:       grep,
    include:    include,
    member:     include,
    inGroupsOf: inGroupsOf,
    inject:     inject,
    invoke:     invoke,
    max:        max,
    min:        min,
    partition:  partition,
    pluck:      pluck,
    reject:     reject,
    sortBy:     sortBy,
    toArray:    toArray,
    entries:    toArray,
    zip:        zip,
    size:       size,
    inspect:    inspect,
    find:       detect
  };
})();

function $A(iterable) {
  if (!iterable) return [];
  if ('toArray' in Object(iterable)) return iterable.toArray();
  var length = iterable.length || 0, results = new Array(length);
  while (length--) results[length] = iterable[length];
  return results;
}


function $w(string) {
  if (!Object.isString(string)) return [];
  string = string.strip();
  return string ? string.split(/\s+/) : [];
}

Array.from = $A;


(function() {
  var arrayProto = Array.prototype,
      slice = arrayProto.slice,
      _each = arrayProto.forEach; // use native browser JS 1.6 implementation if available

  function each(iterator, context) {
    for (var i = 0, length = this.length >>> 0; i < length; i++) {
      if (i in this) iterator.call(context, this[i], i, this);
    }
  }
  if (!_each) _each = each;

  function clear() {
    this.length = 0;
    return this;
  }

  function first() {
    return this[0];
  }

  function last() {
    return this[this.length - 1];
  }

  function compact() {
    return this.select(function(value) {
      return value != null;
    });
  }

  function flatten() {
    return this.inject([], function(array, value) {
      if (Object.isArray(value))
        return array.concat(value.flatten());
      array.push(value);
      return array;
    });
  }

  function without() {
    var values = slice.call(arguments, 0);
    return this.select(function(value) {
      return !values.include(value);
    });
  }

  function reverse(inline) {
    return (inline === false ? this.toArray() : this)._reverse();
  }

  function uniq(sorted) {
    return this.inject([], function(array, value, index) {
      if (0 == index || (sorted ? array.last() != value : !array.include(value)))
        array.push(value);
      return array;
    });
  }

  function intersect(array) {
    return this.uniq().findAll(function(item) {
      return array.detect(function(value) { return item === value });
    });
  }


  function clone() {
    return slice.call(this, 0);
  }

  function size() {
    return this.length;
  }

  function inspect() {
    return '[' + this.map(Object.inspect).join(', ') + ']';
  }

  function indexOf(item, i) {
    i || (i = 0);
    var length = this.length;
    if (i < 0) i = length + i;
    for (; i < length; i++)
      if (this[i] === item) return i;
    return -1;
  }

  function lastIndexOf(item, i) {
    i = isNaN(i) ? this.length : (i < 0 ? this.length + i : i) + 1;
    var n = this.slice(0, i).reverse().indexOf(item);
    return (n < 0) ? n : i - n - 1;
  }

  function concat() {
    var array = slice.call(this, 0), item;
    for (var i = 0, length = arguments.length; i < length; i++) {
      item = arguments[i];
      if (Object.isArray(item) && !('callee' in item)) {
        for (var j = 0, arrayLength = item.length; j < arrayLength; j++)
          array.push(item[j]);
      } else {
        array.push(item);
      }
    }
    return array;
  }

  Object.extend(arrayProto, Enumerable);

  if (!arrayProto._reverse)
    arrayProto._reverse = arrayProto.reverse;

  Object.extend(arrayProto, {
    _each:     _each,
    clear:     clear,
    first:     first,
    last:      last,
    compact:   compact,
    flatten:   flatten,
    without:   without,
    reverse:   reverse,
    uniq:      uniq,
    intersect: intersect,
    clone:     clone,
    toArray:   clone,
    size:      size,
    inspect:   inspect
  });

  var CONCAT_ARGUMENTS_BUGGY = (function() {
    return [].concat(arguments)[0][0] !== 1;
  })(1,2)

  if (CONCAT_ARGUMENTS_BUGGY) arrayProto.concat = concat;

  if (!arrayProto.indexOf) arrayProto.indexOf = indexOf;
  if (!arrayProto.lastIndexOf) arrayProto.lastIndexOf = lastIndexOf;
})();
function $H(object) {
  return new Hash(object);
};

var Hash = Class.create(Enumerable, (function() {
  function initialize(object) {
    this._object = Object.isHash(object) ? object.toObject() : Object.clone(object);
  }


  function _each(iterator) {
    for (var key in this._object) {
      var value = this._object[key], pair = [key, value];
      pair.key = key;
      pair.value = value;
      iterator(pair);
    }
  }

  function set(key, value) {
    return this._object[key] = value;
  }

  function get(key) {
    if (this._object[key] !== Object.prototype[key])
      return this._object[key];
  }

  function unset(key) {
    var value = this._object[key];
    delete this._object[key];
    return value;
  }

  function toObject() {
    return Object.clone(this._object);
  }



  function keys() {
    return this.pluck('key');
  }

  function values() {
    return this.pluck('value');
  }

  function index(value) {
    var match = this.detect(function(pair) {
      return pair.value === value;
    });
    return match && match.key;
  }

  function merge(object) {
    return this.clone().update(object);
  }

  function update(object) {
    return new Hash(object).inject(this, function(result, pair) {
      result.set(pair.key, pair.value);
      return result;
    });
  }

  function toQueryPair(key, value) {
    if (Object.isUndefined(value)) return key;
    return key + '=' + encodeURIComponent(String.interpret(value));
  }

  function toQueryString() {
    return this.inject([], function(results, pair) {
      var key = encodeURIComponent(pair.key), values = pair.value;

      if (values && typeof values == 'object') {
        if (Object.isArray(values)) {
          var queryValues = [];
          for (var i = 0, len = values.length, value; i < len; i++) {
            value = values[i];
            queryValues.push(toQueryPair(key, value));
          }
          return results.concat(queryValues);
        }
      } else results.push(toQueryPair(key, values));
      return results;
    }).join('&');
  }

  function inspect() {
    return '#<Hash:{' + this.map(function(pair) {
      return pair.map(Object.inspect).join(': ');
    }).join(', ') + '}>';
  }

  function clone() {
    return new Hash(this);
  }

  return {
    initialize:             initialize,
    _each:                  _each,
    set:                    set,
    get:                    get,
    unset:                  unset,
    toObject:               toObject,
    toTemplateReplacements: toObject,
    keys:                   keys,
    values:                 values,
    index:                  index,
    merge:                  merge,
    update:                 update,
    toQueryString:          toQueryString,
    inspect:                inspect,
    toJSON:                 toObject,
    clone:                  clone
  };
})());

Hash.from = $H;
Object.extend(Number.prototype, (function() {
  function toColorPart() {
    return this.toPaddedString(2, 16);
  }

  function succ() {
    return this + 1;
  }

  function times(iterator, context) {
    $R(0, this, true).each(iterator, context);
    return this;
  }

  function toPaddedString(length, radix) {
    var string = this.toString(radix || 10);
    return '0'.times(length - string.length) + string;
  }

  function abs() {
    return Math.abs(this);
  }

  function round() {
    return Math.round(this);
  }

  function ceil() {
    return Math.ceil(this);
  }

  function floor() {
    return Math.floor(this);
  }

  return {
    toColorPart:    toColorPart,
    succ:           succ,
    times:          times,
    toPaddedString: toPaddedString,
    abs:            abs,
    round:          round,
    ceil:           ceil,
    floor:          floor
  };
})());

function $R(start, end, exclusive) {
  return new ObjectRange(start, end, exclusive);
}

var ObjectRange = Class.create(Enumerable, (function() {
  function initialize(start, end, exclusive) {
    this.start = start;
    this.end = end;
    this.exclusive = exclusive;
  }

  function _each(iterator) {
    var value = this.start;
    while (this.include(value)) {
      iterator(value);
      value = value.succ();
    }
  }

  function include(value) {
    if (value < this.start)
      return false;
    if (this.exclusive)
      return value < this.end;
    return value <= this.end;
  }

  return {
    initialize: initialize,
    _each:      _each,
    include:    include
  };
})());



var Ajax = {
  getTransport: function() {
    return Try.these(
      function() {return new XMLHttpRequest()},
      function() {return new ActiveXObject('Msxml2.XMLHTTP')},
      function() {return new ActiveXObject('Microsoft.XMLHTTP')}
    ) || false;
  },

  activeRequestCount: 0
};

Ajax.Responders = {
  responders: [],

  _each: function(iterator) {
    this.responders._each(iterator);
  },

  register: function(responder) {
    if (!this.include(responder))
      this.responders.push(responder);
  },

  unregister: function(responder) {
    this.responders = this.responders.without(responder);
  },

  dispatch: function(callback, request, transport, json) {
    this.each(function(responder) {
      if (Object.isFunction(responder[callback])) {
        try {
          responder[callback].apply(responder, [request, transport, json]);
        } catch (e) { }
      }
    });
  }
};

Object.extend(Ajax.Responders, Enumerable);

Ajax.Responders.register({
  onCreate:   function() { Ajax.activeRequestCount++ },
  onComplete: function() { Ajax.activeRequestCount-- }
});
Ajax.Base = Class.create({
  initialize: function(options) {
    this.options = {
      method:       'post',
      asynchronous: true,
      contentType:  'application/x-www-form-urlencoded',
      encoding:     'UTF-8',
      parameters:   '',
      evalJSON:     true,
      evalJS:       true
    };
    Object.extend(this.options, options || { });

    this.options.method = this.options.method.toLowerCase();

    if (Object.isHash(this.options.parameters))
      this.options.parameters = this.options.parameters.toObject();
  }
});
Ajax.Request = Class.create(Ajax.Base, {
  _complete: false,

  initialize: function($super, url, options) {
    $super(options);
    this.transport = Ajax.getTransport();
    this.request(url);
  },

  request: function(url) {
    this.url = url;
    this.method = this.options.method;
    var params = Object.isString(this.options.parameters) ?
          this.options.parameters :
          Object.toQueryString(this.options.parameters);

    if (!['get', 'post'].include(this.method)) {
      params += (params ? '&' : '') + "_method=" + this.method;
      this.method = 'post';
    }

    if (params && this.method === 'get') {
      this.url += (this.url.include('?') ? '&' : '?') + params;
    }

    this.parameters = params.toQueryParams();

    try {
      var response = new Ajax.Response(this);
      if (this.options.onCreate) this.options.onCreate(response);
      Ajax.Responders.dispatch('onCreate', this, response);

      this.transport.open(this.method.toUpperCase(), this.url,
        this.options.asynchronous);

      if (this.options.asynchronous) this.respondToReadyState.bind(this).defer(1);

      this.transport.onreadystatechange = this.onStateChange.bind(this);
      this.setRequestHeaders();

      this.body = this.method == 'post' ? (this.options.postBody || params) : null;
      this.transport.send(this.body);

      /* Force Firefox to handle ready state 4 for synchronous requests */
      if (!this.options.asynchronous && this.transport.overrideMimeType)
        this.onStateChange();

    }
    catch (e) {
      this.dispatchException(e);
    }
  },

  onStateChange: function() {
    var readyState = this.transport.readyState;
    if (readyState > 1 && !((readyState == 4) && this._complete))
      this.respondToReadyState(this.transport.readyState);
  },

  setRequestHeaders: function() {
    var headers = {
      'X-Requested-With': 'XMLHttpRequest',
      'X-Prototype-Version': Prototype.Version,
      'Accept': 'text/javascript, text/html, application/xml, text/xml, */*'
    };

    if (this.method == 'post') {
      headers['Content-type'] = this.options.contentType +
        (this.options.encoding ? '; charset=' + this.options.encoding : '');

      /* Force "Connection: close" for older Mozilla browsers to work
       * around a bug where XMLHttpRequest sends an incorrect
       * Content-length header. See Mozilla Bugzilla #246651.
       */
      if (this.transport.overrideMimeType &&
          (navigator.userAgent.match(/Gecko\/(\d{4})/) || [0,2005])[1] < 2005)
            headers['Connection'] = 'close';
    }

    if (typeof this.options.requestHeaders == 'object') {
      var extras = this.options.requestHeaders;

      if (Object.isFunction(extras.push))
        for (var i = 0, length = extras.length; i < length; i += 2)
          headers[extras[i]] = extras[i+1];
      else
        $H(extras).each(function(pair) { headers[pair.key] = pair.value });
    }

    for (var name in headers)
      this.transport.setRequestHeader(name, headers[name]);
  },

  success: function() {
    var status = this.getStatus();
    return !status || (status >= 200 && status < 300) || status == 304;
  },

  getStatus: function() {
    try {
      if (this.transport.status === 1223) return 204;
      return this.transport.status || 0;
    } catch (e) { return 0 }
  },

  respondToReadyState: function(readyState) {
    var state = Ajax.Request.Events[readyState], response = new Ajax.Response(this);

    if (state == 'Complete') {
      try {
        this._complete = true;
        (this.options['on' + response.status]
         || this.options['on' + (this.success() ? 'Success' : 'Failure')]
         || Prototype.emptyFunction)(response, response.headerJSON);
      } catch (e) {
        this.dispatchException(e);
      }

      var contentType = response.getHeader('Content-type');
      if (this.options.evalJS == 'force'
          || (this.options.evalJS && this.isSameOrigin() && contentType
          && contentType.match(/^\s*(text|application)\/(x-)?(java|ecma)script(;.*)?\s*$/i)))
        this.evalResponse();
    }

    try {
      (this.options['on' + state] || Prototype.emptyFunction)(response, response.headerJSON);
      Ajax.Responders.dispatch('on' + state, this, response, response.headerJSON);
    } catch (e) {
      this.dispatchException(e);
    }

    if (state == 'Complete') {
      this.transport.onreadystatechange = Prototype.emptyFunction;
    }
  },

  isSameOrigin: function() {
    var m = this.url.match(/^\s*https?:\/\/[^\/]*/);
    return !m || (m[0] == '#{protocol}//#{domain}#{port}'.interpolate({
      protocol: location.protocol,
      domain: document.domain,
      port: location.port ? ':' + location.port : ''
    }));
  },

  getHeader: function(name) {
    try {
      return this.transport.getResponseHeader(name) || null;
    } catch (e) { return null; }
  },

  evalResponse: function() {
    try {
      return eval((this.transport.responseText || '').unfilterJSON());
    } catch (e) {
      this.dispatchException(e);
    }
  },

  dispatchException: function(exception) {
    (this.options.onException || Prototype.emptyFunction)(this, exception);
    Ajax.Responders.dispatch('onException', this, exception);
  }
});

Ajax.Request.Events =
  ['Uninitialized', 'Loading', 'Loaded', 'Interactive', 'Complete'];








Ajax.Response = Class.create({
  initialize: function(request){
    this.request = request;
    var transport  = this.transport  = request.transport,
        readyState = this.readyState = transport.readyState;

    if ((readyState > 2 && !Prototype.Browser.IE) || readyState == 4) {
      this.status       = this.getStatus();
      this.statusText   = this.getStatusText();
      this.responseText = String.interpret(transport.responseText);
      this.headerJSON   = this._getHeaderJSON();
    }

    if (readyState == 4) {
      var xml = transport.responseXML;
      this.responseXML  = Object.isUndefined(xml) ? null : xml;
      this.responseJSON = this._getResponseJSON();
    }
  },

  status:      0,

  statusText: '',

  getStatus: Ajax.Request.prototype.getStatus,

  getStatusText: function() {
    try {
      return this.transport.statusText || '';
    } catch (e) { return '' }
  },

  getHeader: Ajax.Request.prototype.getHeader,

  getAllHeaders: function() {
    try {
      return this.getAllResponseHeaders();
    } catch (e) { return null }
  },

  getResponseHeader: function(name) {
    return this.transport.getResponseHeader(name);
  },

  getAllResponseHeaders: function() {
    return this.transport.getAllResponseHeaders();
  },

  _getHeaderJSON: function() {
    var json = this.getHeader('X-JSON');
    if (!json) return null;
    json = decodeURIComponent(escape(json));
    try {
      return json.evalJSON(this.request.options.sanitizeJSON ||
        !this.request.isSameOrigin());
    } catch (e) {
      this.request.dispatchException(e);
    }
  },

  _getResponseJSON: function() {
    var options = this.request.options;
    if (!options.evalJSON || (options.evalJSON != 'force' &&
      !(this.getHeader('Content-type') || '').include('application/json')) ||
        this.responseText.blank())
          return null;
    try {
      return this.responseText.evalJSON(options.sanitizeJSON ||
        !this.request.isSameOrigin());
    } catch (e) {
      this.request.dispatchException(e);
    }
  }
});

Ajax.Updater = Class.create(Ajax.Request, {
  initialize: function($super, container, url, options) {
    this.container = {
      success: (container.success || container),
      failure: (container.failure || (container.success ? null : container))
    };

    options = Object.clone(options);
    var onComplete = options.onComplete;
    options.onComplete = (function(response, json) {
      this.updateContent(response.responseText);
      if (Object.isFunction(onComplete)) onComplete(response, json);
    }).bind(this);

    $super(url, options);
  },

  updateContent: function(responseText) {
    var receiver = this.container[this.success() ? 'success' : 'failure'],
        options = this.options;

    if (!options.evalScripts) responseText = responseText.stripScripts();

    if (receiver = $(receiver)) {
      if (options.insertion) {
        if (Object.isString(options.insertion)) {
          var insertion = { }; insertion[options.insertion] = responseText;
          receiver.insert(insertion);
        }
        else options.insertion(receiver, responseText);
      }
      else receiver.update(responseText);
    }
  }
});

Ajax.PeriodicalUpdater = Class.create(Ajax.Base, {
  initialize: function($super, container, url, options) {
    $super(options);
    this.onComplete = this.options.onComplete;

    this.frequency = (this.options.frequency || 2);
    this.decay = (this.options.decay || 1);

    this.updater = { };
    this.container = container;
    this.url = url;

    this.start();
  },

  start: function() {
    this.options.onComplete = this.updateComplete.bind(this);
    this.onTimerEvent();
  },

  stop: function() {
    this.updater.options.onComplete = undefined;
    clearTimeout(this.timer);
    (this.onComplete || Prototype.emptyFunction).apply(this, arguments);
  },

  updateComplete: function(response) {
    if (this.options.decay) {
      this.decay = (response.responseText == this.lastText ?
        this.decay * this.options.decay : 1);

      this.lastText = response.responseText;
    }
    this.timer = this.onTimerEvent.bind(this).delay(this.decay * this.frequency);
  },

  onTimerEvent: function() {
    this.updater = new Ajax.Updater(this.container, this.url, this.options);
  }
});


function $(element) {
  if (arguments.length > 1) {
    for (var i = 0, elements = [], length = arguments.length; i < length; i++)
      elements.push($(arguments[i]));
    return elements;
  }
  if (Object.isString(element))
    element = document.getElementById(element);
  return Element.extend(element);
}

if (Prototype.BrowserFeatures.XPath) {
  document._getElementsByXPath = function(expression, parentElement) {
    var results = [];
    var query = document.evaluate(expression, $(parentElement) || document,
      null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    for (var i = 0, length = query.snapshotLength; i < length; i++)
      results.push(Element.extend(query.snapshotItem(i)));
    return results;
  };
}

/*--------------------------------------------------------------------------*/

if (!Node) var Node = { };

if (!Node.ELEMENT_NODE) {
  Object.extend(Node, {
    ELEMENT_NODE: 1,
    ATTRIBUTE_NODE: 2,
    TEXT_NODE: 3,
    CDATA_SECTION_NODE: 4,
    ENTITY_REFERENCE_NODE: 5,
    ENTITY_NODE: 6,
    PROCESSING_INSTRUCTION_NODE: 7,
    COMMENT_NODE: 8,
    DOCUMENT_NODE: 9,
    DOCUMENT_TYPE_NODE: 10,
    DOCUMENT_FRAGMENT_NODE: 11,
    NOTATION_NODE: 12
  });
}



(function(global) {
  function shouldUseCache(tagName, attributes) {
    if (tagName === 'select') return false;
    if ('type' in attributes) return false;
    return true;
  }

  var HAS_EXTENDED_CREATE_ELEMENT_SYNTAX = (function(){
    try {
      var el = document.createElement('<input name="x">');
      return el.tagName.toLowerCase() === 'input' && el.name === 'x';
    }
    catch(err) {
      return false;
    }
  })();

  var element = global.Element;

  global.Element = function(tagName, attributes) {
    attributes = attributes || { };
    tagName = tagName.toLowerCase();
    var cache = Element.cache;

    if (HAS_EXTENDED_CREATE_ELEMENT_SYNTAX && attributes.name) {
      tagName = '<' + tagName + ' name="' + attributes.name + '">';
      delete attributes.name;
      return Element.writeAttribute(document.createElement(tagName), attributes);
    }

    if (!cache[tagName]) cache[tagName] = Element.extend(document.createElement(tagName));

    var node = shouldUseCache(tagName, attributes) ?
     cache[tagName].cloneNode(false) : document.createElement(tagName);

    return Element.writeAttribute(node, attributes);
  };

  Object.extend(global.Element, element || { });
  if (element) global.Element.prototype = element.prototype;

})(this);

Element.idCounter = 1;
Element.cache = { };

Element._purgeElement = function(element) {
  var uid = element._prototypeUID;
  if (uid) {
    Element.stopObserving(element);
    element._prototypeUID = void 0;
    delete Element.Storage[uid];
  }
}

Element.Methods = {
  visible: function(element) {
    return $(element).style.display != 'none';
  },

  toggle: function(element) {
    element = $(element);
    Element[Element.visible(element) ? 'hide' : 'show'](element);
    return element;
  },

  hide: function(element) {
    element = $(element);
    element.style.display = 'none';
    return element;
  },

  show: function(element) {
    element = $(element);
    element.style.display = '';
    return element;
  },

  remove: function(element) {
    element = $(element);
    element.parentNode.removeChild(element);
    return element;
  },

  update: (function(){

    var SELECT_ELEMENT_INNERHTML_BUGGY = (function(){
      var el = document.createElement("select"),
          isBuggy = true;
      el.innerHTML = "<option value=\"test\">test</option>";
      if (el.options && el.options[0]) {
        isBuggy = el.options[0].nodeName.toUpperCase() !== "OPTION";
      }
      el = null;
      return isBuggy;
    })();

    var TABLE_ELEMENT_INNERHTML_BUGGY = (function(){
      try {
        var el = document.createElement("table");
        if (el && el.tBodies) {
          el.innerHTML = "<tbody><tr><td>test</td></tr></tbody>";
          var isBuggy = typeof el.tBodies[0] == "undefined";
          el = null;
          return isBuggy;
        }
      } catch (e) {
        return true;
      }
    })();

    var LINK_ELEMENT_INNERHTML_BUGGY = (function() {
      try {
        var el = document.createElement('div');
        el.innerHTML = "<link>";
        var isBuggy = (el.childNodes.length === 0);
        el = null;
        return isBuggy;
      } catch(e) {
        return true;
      }
    })();

    var ANY_INNERHTML_BUGGY = SELECT_ELEMENT_INNERHTML_BUGGY ||
     TABLE_ELEMENT_INNERHTML_BUGGY || LINK_ELEMENT_INNERHTML_BUGGY;

    var SCRIPT_ELEMENT_REJECTS_TEXTNODE_APPENDING = (function () {
      var s = document.createElement("script"),
          isBuggy = false;
      try {
        s.appendChild(document.createTextNode(""));
        isBuggy = !s.firstChild ||
          s.firstChild && s.firstChild.nodeType !== 3;
      } catch (e) {
        isBuggy = true;
      }
      s = null;
      return isBuggy;
    })();


    function update(element, content) {
      element = $(element);
      var purgeElement = Element._purgeElement;

      var descendants = element.getElementsByTagName('*'),
       i = descendants.length;
      while (i--) purgeElement(descendants[i]);

      if (content && content.toElement)
        content = content.toElement();

      if (Object.isElement(content))
        return element.update().insert(content);

      content = Object.toHTML(content);

      var tagName = element.tagName.toUpperCase();

      if (tagName === 'SCRIPT' && SCRIPT_ELEMENT_REJECTS_TEXTNODE_APPENDING) {
        element.text = content;
        return element;
      }

      if (ANY_INNERHTML_BUGGY) {
        if (tagName in Element._insertionTranslations.tags) {
          while (element.firstChild) {
            element.removeChild(element.firstChild);
          }
          Element._getContentFromAnonymousElement(tagName, content.stripScripts())
            .each(function(node) {
              element.appendChild(node)
            });
        } else if (LINK_ELEMENT_INNERHTML_BUGGY && Object.isString(content) && content.indexOf('<link') > -1) {
          while (element.firstChild) {
            element.removeChild(element.firstChild);
          }
          var nodes = Element._getContentFromAnonymousElement(tagName, content.stripScripts(), true);
          nodes.each(function(node) { element.appendChild(node) });
        }
        else {
          element.innerHTML = content.stripScripts();
        }
      }
      else {
        element.innerHTML = content.stripScripts();
      }

      content.evalScripts.bind(content).defer();
      return element;
    }

    return update;
  })(),

  replace: function(element, content) {
    element = $(element);
    if (content && content.toElement) content = content.toElement();
    else if (!Object.isElement(content)) {
      content = Object.toHTML(content);
      var range = element.ownerDocument.createRange();
      range.selectNode(element);
      content.evalScripts.bind(content).defer();
      content = range.createContextualFragment(content.stripScripts());
    }
    element.parentNode.replaceChild(content, element);
    return element;
  },

  insert: function(element, insertions) {
    element = $(element);

    if (Object.isString(insertions) || Object.isNumber(insertions) ||
        Object.isElement(insertions) || (insertions && (insertions.toElement || insertions.toHTML)))
          insertions = {bottom:insertions};

    var content, insert, tagName, childNodes;

    for (var position in insertions) {
      content  = insertions[position];
      position = position.toLowerCase();
      insert = Element._insertionTranslations[position];

      if (content && content.toElement) content = content.toElement();
      if (Object.isElement(content)) {
        insert(element, content);
        continue;
      }

      content = Object.toHTML(content);

      tagName = ((position == 'before' || position == 'after')
        ? element.parentNode : element).tagName.toUpperCase();

      childNodes = Element._getContentFromAnonymousElement(tagName, content.stripScripts());

      if (position == 'top' || position == 'after') childNodes.reverse();
      childNodes.each(insert.curry(element));

      content.evalScripts.bind(content).defer();
    }

    return element;
  },

  wrap: function(element, wrapper, attributes) {
    element = $(element);
    if (Object.isElement(wrapper))
      $(wrapper).writeAttribute(attributes || { });
    else if (Object.isString(wrapper)) wrapper = new Element(wrapper, attributes);
    else wrapper = new Element('div', wrapper);
    if (element.parentNode)
      element.parentNode.replaceChild(wrapper, element);
    wrapper.appendChild(element);
    return wrapper;
  },

  inspect: function(element) {
    element = $(element);
    var result = '<' + element.tagName.toLowerCase();
    $H({'id': 'id', 'className': 'class'}).each(function(pair) {
      var property = pair.first(),
          attribute = pair.last(),
          value = (element[property] || '').toString();
      if (value) result += ' ' + attribute + '=' + value.inspect(true);
    });
    return result + '>';
  },

  recursivelyCollect: function(element, property, maximumLength) {
    element = $(element);
    maximumLength = maximumLength || -1;
    var elements = [];

    while (element = element[property]) {
      if (element.nodeType == 1)
        elements.push(Element.extend(element));
      if (elements.length == maximumLength)
        break;
    }

    return elements;
  },

  ancestors: function(element) {
    return Element.recursivelyCollect(element, 'parentNode');
  },

  descendants: function(element) {
    return Element.select(element, "*");
  },

  firstDescendant: function(element) {
    element = $(element).firstChild;
    while (element && element.nodeType != 1) element = element.nextSibling;
    return $(element);
  },

  immediateDescendants: function(element) {
    var results = [], child = $(element).firstChild;
    while (child) {
      if (child.nodeType === 1) {
        results.push(Element.extend(child));
      }
      child = child.nextSibling;
    }
    return results;
  },

  previousSiblings: function(element, maximumLength) {
    return Element.recursivelyCollect(element, 'previousSibling');
  },

  nextSiblings: function(element) {
    return Element.recursivelyCollect(element, 'nextSibling');
  },

  siblings: function(element) {
    element = $(element);
    return Element.previousSiblings(element).reverse()
      .concat(Element.nextSiblings(element));
  },

  match: function(element, selector) {
    element = $(element);
    if (Object.isString(selector))
      return Prototype.Selector.match(element, selector);
    return selector.match(element);
  },

  up: function(element, expression, index) {
    element = $(element);
    if (arguments.length == 1) return $(element.parentNode);
    var ancestors = Element.ancestors(element);
    return Object.isNumber(expression) ? ancestors[expression] :
      Prototype.Selector.find(ancestors, expression, index);
  },

  down: function(element, expression, index) {
    element = $(element);
    if (arguments.length == 1) return Element.firstDescendant(element);
    return Object.isNumber(expression) ? Element.descendants(element)[expression] :
      Element.select(element, expression)[index || 0];
  },

  previous: function(element, expression, index) {
    element = $(element);
    if (Object.isNumber(expression)) index = expression, expression = false;
    if (!Object.isNumber(index)) index = 0;

    if (expression) {
      return Prototype.Selector.find(element.previousSiblings(), expression, index);
    } else {
      return element.recursivelyCollect("previousSibling", index + 1)[index];
    }
  },

  next: function(element, expression, index) {
    element = $(element);
    if (Object.isNumber(expression)) index = expression, expression = false;
    if (!Object.isNumber(index)) index = 0;

    if (expression) {
      return Prototype.Selector.find(element.nextSiblings(), expression, index);
    } else {
      var maximumLength = Object.isNumber(index) ? index + 1 : 1;
      return element.recursivelyCollect("nextSibling", index + 1)[index];
    }
  },


  select: function(element) {
    element = $(element);
    var expressions = Array.prototype.slice.call(arguments, 1).join(', ');
    return Prototype.Selector.select(expressions, element);
  },

  adjacent: function(element) {
    element = $(element);
    var expressions = Array.prototype.slice.call(arguments, 1).join(', ');
    return Prototype.Selector.select(expressions, element.parentNode).without(element);
  },

  identify: function(element) {
    element = $(element);
    var id = Element.readAttribute(element, 'id');
    if (id) return id;
    do { id = 'anonymous_element_' + Element.idCounter++ } while ($(id));
    Element.writeAttribute(element, 'id', id);
    return id;
  },

  readAttribute: function(element, name) {
    element = $(element);
    if (Prototype.Browser.IE) {
      var t = Element._attributeTranslations.read;
      if (t.values[name]) return t.values[name](element, name);
      if (t.names[name]) name = t.names[name];
      if (name.include(':')) {
        return (!element.attributes || !element.attributes[name]) ? null :
         element.attributes[name].value;
      }
    }
    return element.getAttribute(name);
  },

  writeAttribute: function(element, name, value) {
    element = $(element);
    var attributes = { }, t = Element._attributeTranslations.write;

    if (typeof name == 'object') attributes = name;
    else attributes[name] = Object.isUndefined(value) ? true : value;

    for (var attr in attributes) {
      name = t.names[attr] || attr;
      value = attributes[attr];
      if (t.values[attr]) name = t.values[attr](element, value);
      if (value === false || value === null)
        element.removeAttribute(name);
      else if (value === true)
        element.setAttribute(name, name);
      else element.setAttribute(name, value);
    }
    return element;
  },

  getHeight: function(element) {
    return Element.getDimensions(element).height;
  },

  getWidth: function(element) {
    return Element.getDimensions(element).width;
  },

  classNames: function(element) {
    return new Element.ClassNames(element);
  },

  hasClassName: function(element, className) {
    if (!(element = $(element))) return;
    var elementClassName = element.className;
    return (elementClassName.length > 0 && (elementClassName == className ||
      new RegExp("(^|\\s)" + className + "(\\s|$)").test(elementClassName)));
  },

  addClassName: function(element, className) {
    if (!(element = $(element))) return;
    if (!Element.hasClassName(element, className))
      element.className += (element.className ? ' ' : '') + className;
    return element;
  },

  removeClassName: function(element, className) {
    if (!(element = $(element))) return;
    element.className = element.className.replace(
      new RegExp("(^|\\s+)" + className + "(\\s+|$)"), ' ').strip();
    return element;
  },

  toggleClassName: function(element, className) {
    if (!(element = $(element))) return;
    return Element[Element.hasClassName(element, className) ?
      'removeClassName' : 'addClassName'](element, className);
  },

  cleanWhitespace: function(element) {
    element = $(element);
    var node = element.firstChild;
    while (node) {
      var nextNode = node.nextSibling;
      if (node.nodeType == 3 && !/\S/.test(node.nodeValue))
        element.removeChild(node);
      node = nextNode;
    }
    return element;
  },

  empty: function(element) {
    return $(element).innerHTML.blank();
  },

  descendantOf: function(element, ancestor) {
    element = $(element), ancestor = $(ancestor);

    if (element.compareDocumentPosition)
      return (element.compareDocumentPosition(ancestor) & 8) === 8;

    if (ancestor.contains)
      return ancestor.contains(element) && ancestor !== element;

    while (element = element.parentNode)
      if (element == ancestor) return true;

    return false;
  },

  scrollTo: function(element) {
    element = $(element);
    var pos = Element.cumulativeOffset(element);
    window.scrollTo(pos[0], pos[1]);
    return element;
  },

  getStyle: function(element, style) {
    element = $(element);
    style = style == 'float' ? 'cssFloat' : style.camelize();
    var value = element.style[style];
    if (!value || value == 'auto') {
      var css = document.defaultView.getComputedStyle(element, null);
      value = css ? css[style] : null;
    }
    if (style == 'opacity') return value ? parseFloat(value) : 1.0;
    return value == 'auto' ? null : value;
  },

  getOpacity: function(element) {
    return $(element).getStyle('opacity');
  },

  setStyle: function(element, styles) {
    element = $(element);
    var elementStyle = element.style, match;
    if (Object.isString(styles)) {
      element.style.cssText += ';' + styles;
      return styles.include('opacity') ?
        element.setOpacity(styles.match(/opacity:\s*(\d?\.?\d*)/)[1]) : element;
    }
    for (var property in styles)
      if (property == 'opacity') element.setOpacity(styles[property]);
      else
        elementStyle[(property == 'float' || property == 'cssFloat') ?
          (Object.isUndefined(elementStyle.styleFloat) ? 'cssFloat' : 'styleFloat') :
            property] = styles[property];

    return element;
  },

  setOpacity: function(element, value) {
    element = $(element);
    element.style.opacity = (value == 1 || value === '') ? '' :
      (value < 0.00001) ? 0 : value;
    return element;
  },

  makePositioned: function(element) {
    element = $(element);
    var pos = Element.getStyle(element, 'position');
    if (pos == 'static' || !pos) {
      element._madePositioned = true;
      element.style.position = 'relative';
      if (Prototype.Browser.Opera) {
        element.style.top = 0;
        element.style.left = 0;
      }
    }
    return element;
  },

  undoPositioned: function(element) {
    element = $(element);
    if (element._madePositioned) {
      element._madePositioned = undefined;
      element.style.position =
        element.style.top =
        element.style.left =
        element.style.bottom =
        element.style.right = '';
    }
    return element;
  },

  makeClipping: function(element) {
    element = $(element);
    if (element._overflow) return element;
    element._overflow = Element.getStyle(element, 'overflow') || 'auto';
    if (element._overflow !== 'hidden')
      element.style.overflow = 'hidden';
    return element;
  },

  undoClipping: function(element) {
    element = $(element);
    if (!element._overflow) return element;
    element.style.overflow = element._overflow == 'auto' ? '' : element._overflow;
    element._overflow = null;
    return element;
  },

  clonePosition: function(element, source) {
    var options = Object.extend({
      setLeft:    true,
      setTop:     true,
      setWidth:   true,
      setHeight:  true,
      offsetTop:  0,
      offsetLeft: 0
    }, arguments[2] || { });

    source = $(source);
    var p = Element.viewportOffset(source), delta = [0, 0], parent = null;

    element = $(element);

    if (Element.getStyle(element, 'position') == 'absolute') {
      parent = Element.getOffsetParent(element);
      delta = Element.viewportOffset(parent);
    }

    if (parent == document.body) {
      delta[0] -= document.body.offsetLeft;
      delta[1] -= document.body.offsetTop;
    }

    if (options.setLeft)   element.style.left  = (p[0] - delta[0] + options.offsetLeft) + 'px';
    if (options.setTop)    element.style.top   = (p[1] - delta[1] + options.offsetTop) + 'px';
    if (options.setWidth)  element.style.width = source.offsetWidth + 'px';
    if (options.setHeight) element.style.height = source.offsetHeight + 'px';
    return element;
  }
};

Object.extend(Element.Methods, {
  getElementsBySelector: Element.Methods.select,

  childElements: Element.Methods.immediateDescendants
});

Element._attributeTranslations = {
  write: {
    names: {
      className: 'class',
      htmlFor:   'for'
    },
    values: { }
  }
};

if (Prototype.Browser.Opera) {
  Element.Methods.getStyle = Element.Methods.getStyle.wrap(
    function(proceed, element, style) {
      switch (style) {
        case 'height': case 'width':
          if (!Element.visible(element)) return null;

          var dim = parseInt(proceed(element, style), 10);

          if (dim !== element['offset' + style.capitalize()])
            return dim + 'px';

          var properties;
          if (style === 'height') {
            properties = ['border-top-width', 'padding-top',
             'padding-bottom', 'border-bottom-width'];
          }
          else {
            properties = ['border-left-width', 'padding-left',
             'padding-right', 'border-right-width'];
          }
          return properties.inject(dim, function(memo, property) {
            var val = proceed(element, property);
            return val === null ? memo : memo - parseInt(val, 10);
          }) + 'px';
        default: return proceed(element, style);
      }
    }
  );

  Element.Methods.readAttribute = Element.Methods.readAttribute.wrap(
    function(proceed, element, attribute) {
      if (attribute === 'title') return element.title;
      return proceed(element, attribute);
    }
  );
}

else if (Prototype.Browser.IE) {
  Element.Methods.getStyle = function(element, style) {
    element = $(element);
    style = (style == 'float' || style == 'cssFloat') ? 'styleFloat' : style.camelize();
    var value = element.style[style];
    if (!value && element.currentStyle) value = element.currentStyle[style];

    if (style == 'opacity') {
      if (value = (element.getStyle('filter') || '').match(/alpha\(opacity=(.*)\)/))
        if (value[1]) return parseFloat(value[1]) / 100;
      return 1.0;
    }

    if (value == 'auto') {
      if ((style == 'width' || style == 'height') && (element.getStyle('display') != 'none'))
        return element['offset' + style.capitalize()] + 'px';
      return null;
    }
    return value;
  };

  Element.Methods.setOpacity = function(element, value) {
    function stripAlpha(filter){
      return filter.replace(/alpha\([^\)]*\)/gi,'');
    }
    element = $(element);
    var currentStyle = element.currentStyle;
    if ((currentStyle && !currentStyle.hasLayout) ||
      (!currentStyle && element.style.zoom == 'normal'))
        element.style.zoom = 1;

    var filter = element.getStyle('filter'), style = element.style;
    if (value == 1 || value === '') {
      (filter = stripAlpha(filter)) ?
        style.filter = filter : style.removeAttribute('filter');
      return element;
    } else if (value < 0.00001) value = 0;
    style.filter = stripAlpha(filter) +
      'alpha(opacity=' + (value * 100) + ')';
    return element;
  };

  Element._attributeTranslations = (function(){

    var classProp = 'className',
        forProp = 'for',
        el = document.createElement('div');

    el.setAttribute(classProp, 'x');

    if (el.className !== 'x') {
      el.setAttribute('class', 'x');
      if (el.className === 'x') {
        classProp = 'class';
      }
    }
    el = null;

    el = document.createElement('label');
    el.setAttribute(forProp, 'x');
    if (el.htmlFor !== 'x') {
      el.setAttribute('htmlFor', 'x');
      if (el.htmlFor === 'x') {
        forProp = 'htmlFor';
      }
    }
    el = null;

    return {
      read: {
        names: {
          'class':      classProp,
          'className':  classProp,
          'for':        forProp,
          'htmlFor':    forProp
        },
        values: {
          _getAttr: function(element, attribute) {
            return element.getAttribute(attribute);
          },
          _getAttr2: function(element, attribute) {
            return element.getAttribute(attribute, 2);
          },
          _getAttrNode: function(element, attribute) {
            var node = element.getAttributeNode(attribute);
            return node ? node.value : "";
          },
          _getEv: (function(){

            var el = document.createElement('div'), f;
            el.onclick = Prototype.emptyFunction;
            var value = el.getAttribute('onclick');

            if (String(value).indexOf('{') > -1) {
              f = function(element, attribute) {
                attribute = element.getAttribute(attribute);
                if (!attribute) return null;
                attribute = attribute.toString();
                attribute = attribute.split('{')[1];
                attribute = attribute.split('}')[0];
                return attribute.strip();
              };
            }
            else if (value === '') {
              f = function(element, attribute) {
                attribute = element.getAttribute(attribute);
                if (!attribute) return null;
                return attribute.strip();
              };
            }
            el = null;
            return f;
          })(),
          _flag: function(element, attribute) {
            return $(element).hasAttribute(attribute) ? attribute : null;
          },
          style: function(element) {
            return element.style.cssText.toLowerCase();
          },
          title: function(element) {
            return element.title;
          }
        }
      }
    }
  })();

  Element._attributeTranslations.write = {
    names: Object.extend({
      cellpadding: 'cellPadding',
      cellspacing: 'cellSpacing'
    }, Element._attributeTranslations.read.names),
    values: {
      checked: function(element, value) {
        element.checked = !!value;
      },

      style: function(element, value) {
        element.style.cssText = value ? value : '';
      }
    }
  };

  Element._attributeTranslations.has = {};

  $w('colSpan rowSpan vAlign dateTime accessKey tabIndex ' +
      'encType maxLength readOnly longDesc frameBorder').each(function(attr) {
    Element._attributeTranslations.write.names[attr.toLowerCase()] = attr;
    Element._attributeTranslations.has[attr.toLowerCase()] = attr;
  });

  (function(v) {
    Object.extend(v, {
      href:        v._getAttr2,
      src:         v._getAttr2,
      type:        v._getAttr,
      action:      v._getAttrNode,
      disabled:    v._flag,
      checked:     v._flag,
      readonly:    v._flag,
      multiple:    v._flag,
      onload:      v._getEv,
      onunload:    v._getEv,
      onclick:     v._getEv,
      ondblclick:  v._getEv,
      onmousedown: v._getEv,
      onmouseup:   v._getEv,
      onmouseover: v._getEv,
      onmousemove: v._getEv,
      onmouseout:  v._getEv,
      onfocus:     v._getEv,
      onblur:      v._getEv,
      onkeypress:  v._getEv,
      onkeydown:   v._getEv,
      onkeyup:     v._getEv,
      onsubmit:    v._getEv,
      onreset:     v._getEv,
      onselect:    v._getEv,
      onchange:    v._getEv
    });
  })(Element._attributeTranslations.read.values);

  if (Prototype.BrowserFeatures.ElementExtensions) {
    (function() {
      function _descendants(element) {
        var nodes = element.getElementsByTagName('*'), results = [];
        for (var i = 0, node; node = nodes[i]; i++)
          if (node.tagName !== "!") // Filter out comment nodes.
            results.push(node);
        return results;
      }

      Element.Methods.down = function(element, expression, index) {
        element = $(element);
        if (arguments.length == 1) return element.firstDescendant();
        return Object.isNumber(expression) ? _descendants(element)[expression] :
          Element.select(element, expression)[index || 0];
      }
    })();
  }

}

else if (Prototype.Browser.Gecko && /rv:1\.8\.0/.test(navigator.userAgent)) {
  Element.Methods.setOpacity = function(element, value) {
    element = $(element);
    element.style.opacity = (value == 1) ? 0.999999 :
      (value === '') ? '' : (value < 0.00001) ? 0 : value;
    return element;
  };
}

else if (Prototype.Browser.WebKit) {
  Element.Methods.setOpacity = function(element, value) {
    element = $(element);
    element.style.opacity = (value == 1 || value === '') ? '' :
      (value < 0.00001) ? 0 : value;

    if (value == 1)
      if (element.tagName.toUpperCase() == 'IMG' && element.width) {
        element.width++; element.width--;
      } else try {
        var n = document.createTextNode(' ');
        element.appendChild(n);
        element.removeChild(n);
      } catch (e) { }

    return element;
  };
}

if ('outerHTML' in document.documentElement) {
  Element.Methods.replace = function(element, content) {
    element = $(element);

    if (content && content.toElement) content = content.toElement();
    if (Object.isElement(content)) {
      element.parentNode.replaceChild(content, element);
      return element;
    }

    content = Object.toHTML(content);
    var parent = element.parentNode, tagName = parent.tagName.toUpperCase();

    if (Element._insertionTranslations.tags[tagName]) {
      var nextSibling = element.next(),
          fragments = Element._getContentFromAnonymousElement(tagName, content.stripScripts());
      parent.removeChild(element);
      if (nextSibling)
        fragments.each(function(node) { parent.insertBefore(node, nextSibling) });
      else
        fragments.each(function(node) { parent.appendChild(node) });
    }
    else element.outerHTML = content.stripScripts();

    content.evalScripts.bind(content).defer();
    return element;
  };
}

Element._returnOffset = function(l, t) {
  var result = [l, t];
  result.left = l;
  result.top = t;
  return result;
};

Element._getContentFromAnonymousElement = function(tagName, html, force) {
  var div = new Element('div'),
      t = Element._insertionTranslations.tags[tagName];

  var workaround = false;
  if (t) workaround = true;
  else if (force) {
    workaround = true;
    t = ['', '', 0];
  }

  if (workaround) {
    div.innerHTML = '&nbsp;' + t[0] + html + t[1];
    div.removeChild(div.firstChild);
    for (var i = t[2]; i--; ) {
      div = div.firstChild;
    }
  }
  else {
    div.innerHTML = html;
  }
  return $A(div.childNodes);
};

Element._insertionTranslations = {
  before: function(element, node) {
    element.parentNode.insertBefore(node, element);
  },
  top: function(element, node) {
    element.insertBefore(node, element.firstChild);
  },
  bottom: function(element, node) {
    element.appendChild(node);
  },
  after: function(element, node) {
    element.parentNode.insertBefore(node, element.nextSibling);
  },
  tags: {
    TABLE:  ['<table>',                '</table>',                   1],
    TBODY:  ['<table><tbody>',         '</tbody></table>',           2],
    TR:     ['<table><tbody><tr>',     '</tr></tbody></table>',      3],
    TD:     ['<table><tbody><tr><td>', '</td></tr></tbody></table>', 4],
    SELECT: ['<select>',               '</select>',                  1]
  }
};

(function() {
  var tags = Element._insertionTranslations.tags;
  Object.extend(tags, {
    THEAD: tags.TBODY,
    TFOOT: tags.TBODY,
    TH:    tags.TD
  });
})();

Element.Methods.Simulated = {
  hasAttribute: function(element, attribute) {
    attribute = Element._attributeTranslations.has[attribute] || attribute;
    var node = $(element).getAttributeNode(attribute);
    return !!(node && node.specified);
  }
};

Element.Methods.ByTag = { };

Object.extend(Element, Element.Methods);

(function(div) {

  if (!Prototype.BrowserFeatures.ElementExtensions && div['__proto__']) {
    window.HTMLElement = { };
    window.HTMLElement.prototype = div['__proto__'];
    Prototype.BrowserFeatures.ElementExtensions = true;
  }

  div = null;

})(document.createElement('div'));

Element.extend = (function() {

  function checkDeficiency(tagName) {
    if (typeof window.Element != 'undefined') {
      var proto = window.Element.prototype;
      if (proto) {
        var id = '_' + (Math.random()+'').slice(2),
            el = document.createElement(tagName);
        proto[id] = 'x';
        var isBuggy = (el[id] !== 'x');
        delete proto[id];
        el = null;
        return isBuggy;
      }
    }
    return false;
  }

  function extendElementWith(element, methods) {
    for (var property in methods) {
      var value = methods[property];
      if (Object.isFunction(value) && !(property in element))
        element[property] = value.methodize();
    }
  }

  var HTMLOBJECTELEMENT_PROTOTYPE_BUGGY = checkDeficiency('object');

  if (Prototype.BrowserFeatures.SpecificElementExtensions) {
    if (HTMLOBJECTELEMENT_PROTOTYPE_BUGGY) {
      return function(element) {
        if (element && typeof element._extendedByPrototype == 'undefined') {
          var t = element.tagName;
          if (t && (/^(?:object|applet|embed)$/i.test(t))) {
            extendElementWith(element, Element.Methods);
            extendElementWith(element, Element.Methods.Simulated);
            extendElementWith(element, Element.Methods.ByTag[t.toUpperCase()]);
          }
        }
        return element;
      }
    }
    return Prototype.K;
  }

  var Methods = { }, ByTag = Element.Methods.ByTag;

  var extend = Object.extend(function(element) {
    if (!element || typeof element._extendedByPrototype != 'undefined' ||
        element.nodeType != 1 || element == window) return element;

    var methods = Object.clone(Methods),
        tagName = element.tagName.toUpperCase();

    if (ByTag[tagName]) Object.extend(methods, ByTag[tagName]);

    extendElementWith(element, methods);

    element._extendedByPrototype = Prototype.emptyFunction;
    return element;

  }, {
    refresh: function() {
      if (!Prototype.BrowserFeatures.ElementExtensions) {
        Object.extend(Methods, Element.Methods);
        Object.extend(Methods, Element.Methods.Simulated);
      }
    }
  });

  extend.refresh();
  return extend;
})();

if (document.documentElement.hasAttribute) {
  Element.hasAttribute = function(element, attribute) {
    return element.hasAttribute(attribute);
  };
}
else {
  Element.hasAttribute = Element.Methods.Simulated.hasAttribute;
}

Element.addMethods = function(methods) {
  var F = Prototype.BrowserFeatures, T = Element.Methods.ByTag;

  if (!methods) {
    Object.extend(Form, Form.Methods);
    Object.extend(Form.Element, Form.Element.Methods);
    Object.extend(Element.Methods.ByTag, {
      "FORM":     Object.clone(Form.Methods),
      "INPUT":    Object.clone(Form.Element.Methods),
      "SELECT":   Object.clone(Form.Element.Methods),
      "TEXTAREA": Object.clone(Form.Element.Methods),
      "BUTTON":   Object.clone(Form.Element.Methods)
    });
  }

  if (arguments.length == 2) {
    var tagName = methods;
    methods = arguments[1];
  }

  if (!tagName) Object.extend(Element.Methods, methods || { });
  else {
    if (Object.isArray(tagName)) tagName.each(extend);
    else extend(tagName);
  }

  function extend(tagName) {
    tagName = tagName.toUpperCase();
    if (!Element.Methods.ByTag[tagName])
      Element.Methods.ByTag[tagName] = { };
    Object.extend(Element.Methods.ByTag[tagName], methods);
  }

  function copy(methods, destination, onlyIfAbsent) {
    onlyIfAbsent = onlyIfAbsent || false;
    for (var property in methods) {
      var value = methods[property];
      if (!Object.isFunction(value)) continue;
      if (!onlyIfAbsent || !(property in destination))
        destination[property] = value.methodize();
    }
  }

  function findDOMClass(tagName) {
    var klass;
    var trans = {
      "OPTGROUP": "OptGroup", "TEXTAREA": "TextArea", "P": "Paragraph",
      "FIELDSET": "FieldSet", "UL": "UList", "OL": "OList", "DL": "DList",
      "DIR": "Directory", "H1": "Heading", "H2": "Heading", "H3": "Heading",
      "H4": "Heading", "H5": "Heading", "H6": "Heading", "Q": "Quote",
      "INS": "Mod", "DEL": "Mod", "A": "Anchor", "IMG": "Image", "CAPTION":
      "TableCaption", "COL": "TableCol", "COLGROUP": "TableCol", "THEAD":
      "TableSection", "TFOOT": "TableSection", "TBODY": "TableSection", "TR":
      "TableRow", "TH": "TableCell", "TD": "TableCell", "FRAMESET":
      "FrameSet", "IFRAME": "IFrame"
    };
    if (trans[tagName]) klass = 'HTML' + trans[tagName] + 'Element';
    if (window[klass]) return window[klass];
    klass = 'HTML' + tagName + 'Element';
    if (window[klass]) return window[klass];
    klass = 'HTML' + tagName.capitalize() + 'Element';
    if (window[klass]) return window[klass];

    var element = document.createElement(tagName),
        proto = element['__proto__'] || element.constructor.prototype;

    element = null;
    return proto;
  }

  var elementPrototype = window.HTMLElement ? HTMLElement.prototype :
   Element.prototype;

  if (F.ElementExtensions) {
    copy(Element.Methods, elementPrototype);
    copy(Element.Methods.Simulated, elementPrototype, true);
  }

  if (F.SpecificElementExtensions) {
    for (var tag in Element.Methods.ByTag) {
      var klass = findDOMClass(tag);
      if (Object.isUndefined(klass)) continue;
      copy(T[tag], klass.prototype);
    }
  }

  Object.extend(Element, Element.Methods);
  delete Element.ByTag;

  if (Element.extend.refresh) Element.extend.refresh();
  Element.cache = { };
};


document.viewport = {

  getDimensions: function() {
    return { width: this.getWidth(), height: this.getHeight() };
  },

  getScrollOffsets: function() {
    return Element._returnOffset(
      window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft,
      window.pageYOffset || document.documentElement.scrollTop  || document.body.scrollTop);
  }
};

(function(viewport) {
  var B = Prototype.Browser, doc = document, element, property = {};

  function getRootElement() {
    if (B.WebKit && !doc.evaluate)
      return document;

    if (B.Opera && window.parseFloat(window.opera.version()) < 9.5)
      return document.body;

    return document.documentElement;
  }

  function define(D) {
    if (!element) element = getRootElement();

    property[D] = 'client' + D;

    viewport['get' + D] = function() { return element[property[D]] };
    return viewport['get' + D]();
  }

  viewport.getWidth  = define.curry('Width');

  viewport.getHeight = define.curry('Height');
})(document.viewport);


Element.Storage = {
  UID: 1
};

Element.addMethods({
  getStorage: function(element) {
    if (!(element = $(element))) return;

    var uid;
    if (element === window) {
      uid = 0;
    } else {
      if (typeof element._prototypeUID === "undefined")
        element._prototypeUID = Element.Storage.UID++;
      uid = element._prototypeUID;
    }

    if (!Element.Storage[uid])
      Element.Storage[uid] = $H();

    return Element.Storage[uid];
  },

  store: function(element, key, value) {
    if (!(element = $(element))) return;

    if (arguments.length === 2) {
      Element.getStorage(element).update(key);
    } else {
      Element.getStorage(element).set(key, value);
    }

    return element;
  },

  retrieve: function(element, key, defaultValue) {
    if (!(element = $(element))) return;
    var hash = Element.getStorage(element), value = hash.get(key);

    if (Object.isUndefined(value)) {
      hash.set(key, defaultValue);
      value = defaultValue;
    }

    return value;
  },

  clone: function(element, deep) {
    if (!(element = $(element))) return;
    var clone = element.cloneNode(deep);
    clone._prototypeUID = void 0;
    if (deep) {
      var descendants = Element.select(clone, '*'),
          i = descendants.length;
      while (i--) {
        descendants[i]._prototypeUID = void 0;
      }
    }
    return Element.extend(clone);
  },

  purge: function(element) {
    if (!(element = $(element))) return;
    var purgeElement = Element._purgeElement;

    purgeElement(element);

    var descendants = element.getElementsByTagName('*'),
     i = descendants.length;

    while (i--) purgeElement(descendants[i]);

    return null;
  }
});

(function() {

  function toDecimal(pctString) {
    var match = pctString.match(/^(\d+)%?$/i);
    if (!match) return null;
    return (Number(match[1]) / 100);
  }

  function getPixelValue(value, property, context) {
    var element = null;
    if (Object.isElement(value)) {
      element = value;
      value = element.getStyle(property);
    }

    if (value === null) {
      return null;
    }

    if ((/^(?:-)?\d+(\.\d+)?(px)?$/i).test(value)) {
      return window.parseFloat(value);
    }

    var isPercentage = value.include('%'), isViewport = (context === document.viewport);

    if (/\d/.test(value) && element && element.runtimeStyle && !(isPercentage && isViewport)) {
      var style = element.style.left, rStyle = element.runtimeStyle.left;
      element.runtimeStyle.left = element.currentStyle.left;
      element.style.left = value || 0;
      value = element.style.pixelLeft;
      element.style.left = style;
      element.runtimeStyle.left = rStyle;

      return value;
    }

    if (element && isPercentage) {
      context = context || element.parentNode;
      var decimal = toDecimal(value);
      var whole = null;
      var position = element.getStyle('position');

      var isHorizontal = property.include('left') || property.include('right') ||
       property.include('width');

      var isVertical =  property.include('top') || property.include('bottom') ||
        property.include('height');

      if (context === document.viewport) {
        if (isHorizontal) {
          whole = document.viewport.getWidth();
        } else if (isVertical) {
          whole = document.viewport.getHeight();
        }
      } else {
        if (isHorizontal) {
          whole = $(context).measure('width');
        } else if (isVertical) {
          whole = $(context).measure('height');
        }
      }

      return (whole === null) ? 0 : whole * decimal;
    }

    return 0;
  }

  function toCSSPixels(number) {
    if (Object.isString(number) && number.endsWith('px')) {
      return number;
    }
    return number + 'px';
  }

  function isDisplayed(element) {
    var originalElement = element;
    while (element && element.parentNode) {
      var display = element.getStyle('display');
      if (display === 'none') {
        return false;
      }
      element = $(element.parentNode);
    }
    return true;
  }

  var hasLayout = Prototype.K;
  if ('currentStyle' in document.documentElement) {
    hasLayout = function(element) {
      if (!element.currentStyle.hasLayout) {
        element.style.zoom = 1;
      }
      return element;
    };
  }

  function cssNameFor(key) {
    if (key.include('border')) key = key + '-width';
    return key.camelize();
  }

  Element.Layout = Class.create(Hash, {
    initialize: function($super, element, preCompute) {
      $super();
      this.element = $(element);

      Element.Layout.PROPERTIES.each( function(property) {
        this._set(property, null);
      }, this);

      if (preCompute) {
        this._preComputing = true;
        this._begin();
        Element.Layout.PROPERTIES.each( this._compute, this );
        this._end();
        this._preComputing = false;
      }
    },

    _set: function(property, value) {
      return Hash.prototype.set.call(this, property, value);
    },

    set: function(property, value) {
      throw "Properties of Element.Layout are read-only.";
    },

    get: function($super, property) {
      var value = $super(property);
      return value === null ? this._compute(property) : value;
    },

    _begin: function() {
      if (this._prepared) return;

      var element = this.element;
      if (isDisplayed(element)) {
        this._prepared = true;
        return;
      }

      var originalStyles = {
        position:   element.style.position   || '',
        width:      element.style.width      || '',
        visibility: element.style.visibility || '',
        display:    element.style.display    || ''
      };

      element.store('prototype_original_styles', originalStyles);

      var position = element.getStyle('position'),
       width = element.getStyle('width');

      if (width === "0px" || width === null) {
        element.style.display = 'block';
        width = element.getStyle('width');
      }

      var context = (position === 'fixed') ? document.viewport :
       element.parentNode;

      element.setStyle({
        position:   'absolute',
        visibility: 'hidden',
        display:    'block'
      });

      var positionedWidth = element.getStyle('width');

      var newWidth;
      if (width && (positionedWidth === width)) {
        newWidth = getPixelValue(element, 'width', context);
      } else if (position === 'absolute' || position === 'fixed') {
        newWidth = getPixelValue(element, 'width', context);
      } else {
        var parent = element.parentNode, pLayout = $(parent).getLayout();

        newWidth = pLayout.get('width') -
         this.get('margin-left') -
         this.get('border-left') -
         this.get('padding-left') -
         this.get('padding-right') -
         this.get('border-right') -
         this.get('margin-right');
      }

      element.setStyle({ width: newWidth + 'px' });

      this._prepared = true;
    },

    _end: function() {
      var element = this.element;
      var originalStyles = element.retrieve('prototype_original_styles');
      element.store('prototype_original_styles', null);
      element.setStyle(originalStyles);
      this._prepared = false;
    },

    _compute: function(property) {
      var COMPUTATIONS = Element.Layout.COMPUTATIONS;
      if (!(property in COMPUTATIONS)) {
        throw "Property not found.";
      }

      return this._set(property, COMPUTATIONS[property].call(this, this.element));
    },

    toObject: function() {
      var args = $A(arguments);
      var keys = (args.length === 0) ? Element.Layout.PROPERTIES :
       args.join(' ').split(' ');
      var obj = {};
      keys.each( function(key) {
        if (!Element.Layout.PROPERTIES.include(key)) return;
        var value = this.get(key);
        if (value != null) obj[key] = value;
      }, this);
      return obj;
    },

    toHash: function() {
      var obj = this.toObject.apply(this, arguments);
      return new Hash(obj);
    },

    toCSS: function() {
      var args = $A(arguments);
      var keys = (args.length === 0) ? Element.Layout.PROPERTIES :
       args.join(' ').split(' ');
      var css = {};

      keys.each( function(key) {
        if (!Element.Layout.PROPERTIES.include(key)) return;
        if (Element.Layout.COMPOSITE_PROPERTIES.include(key)) return;

        var value = this.get(key);
        if (value != null) css[cssNameFor(key)] = value + 'px';
      }, this);
      return css;
    },

    inspect: function() {
      return "#<Element.Layout>";
    }
  });

  Object.extend(Element.Layout, {
    PROPERTIES: $w('height width top left right bottom border-left border-right border-top border-bottom padding-left padding-right padding-top padding-bottom margin-top margin-bottom margin-left margin-right padding-box-width padding-box-height border-box-width border-box-height margin-box-width margin-box-height'),

    COMPOSITE_PROPERTIES: $w('padding-box-width padding-box-height margin-box-width margin-box-height border-box-width border-box-height'),

    COMPUTATIONS: {
      'height': function(element) {
        if (!this._preComputing) this._begin();

        var bHeight = this.get('border-box-height');
        if (bHeight <= 0) {
          if (!this._preComputing) this._end();
          return 0;
        }

        var bTop = this.get('border-top'),
         bBottom = this.get('border-bottom');

        var pTop = this.get('padding-top'),
         pBottom = this.get('padding-bottom');

        if (!this._preComputing) this._end();

        return bHeight - bTop - bBottom - pTop - pBottom;
      },

      'width': function(element) {
        if (!this._preComputing) this._begin();

        var bWidth = this.get('border-box-width');
        if (bWidth <= 0) {
          if (!this._preComputing) this._end();
          return 0;
        }

        var bLeft = this.get('border-left'),
         bRight = this.get('border-right');

        var pLeft = this.get('padding-left'),
         pRight = this.get('padding-right');

        if (!this._preComputing) this._end();

        return bWidth - bLeft - bRight - pLeft - pRight;
      },

      'padding-box-height': function(element) {
        var height = this.get('height'),
         pTop = this.get('padding-top'),
         pBottom = this.get('padding-bottom');

        return height + pTop + pBottom;
      },

      'padding-box-width': function(element) {
        var width = this.get('width'),
         pLeft = this.get('padding-left'),
         pRight = this.get('padding-right');

        return width + pLeft + pRight;
      },

      'border-box-height': function(element) {
        if (!this._preComputing) this._begin();
        var height = element.offsetHeight;
        if (!this._preComputing) this._end();
        return height;
      },

      'border-box-width': function(element) {
        if (!this._preComputing) this._begin();
        var width = element.offsetWidth;
        if (!this._preComputing) this._end();
        return width;
      },

      'margin-box-height': function(element) {
        var bHeight = this.get('border-box-height'),
         mTop = this.get('margin-top'),
         mBottom = this.get('margin-bottom');

        if (bHeight <= 0) return 0;

        return bHeight + mTop + mBottom;
      },

      'margin-box-width': function(element) {
        var bWidth = this.get('border-box-width'),
         mLeft = this.get('margin-left'),
         mRight = this.get('margin-right');

        if (bWidth <= 0) return 0;

        return bWidth + mLeft + mRight;
      },

      'top': function(element) {
        var offset = element.positionedOffset();
        return offset.top;
      },

      'bottom': function(element) {
        var offset = element.positionedOffset(),
         parent = element.getOffsetParent(),
         pHeight = parent.measure('height');

        var mHeight = this.get('border-box-height');

        return pHeight - mHeight - offset.top;
      },

      'left': function(element) {
        var offset = element.positionedOffset();
        return offset.left;
      },

      'right': function(element) {
        var offset = element.positionedOffset(),
         parent = element.getOffsetParent(),
         pWidth = parent.measure('width');

        var mWidth = this.get('border-box-width');

        return pWidth - mWidth - offset.left;
      },

      'padding-top': function(element) {
        return getPixelValue(element, 'paddingTop');
      },

      'padding-bottom': function(element) {
        return getPixelValue(element, 'paddingBottom');
      },

      'padding-left': function(element) {
        return getPixelValue(element, 'paddingLeft');
      },

      'padding-right': function(element) {
        return getPixelValue(element, 'paddingRight');
      },

      'border-top': function(element) {
        return getPixelValue(element, 'borderTopWidth');
      },

      'border-bottom': function(element) {
        return getPixelValue(element, 'borderBottomWidth');
      },

      'border-left': function(element) {
        return getPixelValue(element, 'borderLeftWidth');
      },

      'border-right': function(element) {
        return getPixelValue(element, 'borderRightWidth');
      },

      'margin-top': function(element) {
        return getPixelValue(element, 'marginTop');
      },

      'margin-bottom': function(element) {
        return getPixelValue(element, 'marginBottom');
      },

      'margin-left': function(element) {
        return getPixelValue(element, 'marginLeft');
      },

      'margin-right': function(element) {
        return getPixelValue(element, 'marginRight');
      }
    }
  });

  if ('getBoundingClientRect' in document.documentElement) {
    Object.extend(Element.Layout.COMPUTATIONS, {
      'right': function(element) {
        var parent = hasLayout(element.getOffsetParent());
        var rect = element.getBoundingClientRect(),
         pRect = parent.getBoundingClientRect();

        return (pRect.right - rect.right).round();
      },

      'bottom': function(element) {
        var parent = hasLayout(element.getOffsetParent());
        var rect = element.getBoundingClientRect(),
         pRect = parent.getBoundingClientRect();

        return (pRect.bottom - rect.bottom).round();
      }
    });
  }

  Element.Offset = Class.create({
    initialize: function(left, top) {
      this.left = left.round();
      this.top  = top.round();

      this[0] = this.left;
      this[1] = this.top;
    },

    relativeTo: function(offset) {
      return new Element.Offset(
        this.left - offset.left,
        this.top  - offset.top
      );
    },

    inspect: function() {
      return "#<Element.Offset left: #{left} top: #{top}>".interpolate(this);
    },

    toString: function() {
      return "[#{left}, #{top}]".interpolate(this);
    },

    toArray: function() {
      return [this.left, this.top];
    }
  });

  function getLayout(element, preCompute) {
    return new Element.Layout(element, preCompute);
  }

  function measure(element, property) {
    return $(element).getLayout().get(property);
  }

  function getDimensions(element) {
    element = $(element);
    var display = Element.getStyle(element, 'display');

    if (display && display !== 'none') {
      return { width: element.offsetWidth, height: element.offsetHeight };
    }

    var style = element.style;
    var originalStyles = {
      visibility: style.visibility,
      position:   style.position,
      display:    style.display
    };

    var newStyles = {
      visibility: 'hidden',
      display:    'block'
    };

    if (originalStyles.position !== 'fixed')
      newStyles.position = 'absolute';

    Element.setStyle(element, newStyles);

    var dimensions = {
      width:  element.offsetWidth,
      height: element.offsetHeight
    };

    Element.setStyle(element, originalStyles);

    return dimensions;
  }

  function getOffsetParent(element) {
    element = $(element);

    if (isDocument(element) || isDetached(element) || isBody(element) || isHtml(element))
      return $(document.body);

    var isInline = (Element.getStyle(element, 'display') === 'inline');
    if (!isInline && element.offsetParent) return $(element.offsetParent);

    while ((element = element.parentNode) && element !== document.body) {
      if (Element.getStyle(element, 'position') !== 'static') {
        return isHtml(element) ? $(document.body) : $(element);
      }
    }

    return $(document.body);
  }


  function cumulativeOffset(element) {
    element = $(element);
    var valueT = 0, valueL = 0;
    if (element.parentNode) {
      do {
        valueT += element.offsetTop  || 0;
        valueL += element.offsetLeft || 0;
        element = element.offsetParent;
      } while (element);
    }
    return new Element.Offset(valueL, valueT);
  }

  function positionedOffset(element) {
    element = $(element);

    var layout = element.getLayout();

    var valueT = 0, valueL = 0;
    do {
      valueT += element.offsetTop  || 0;
      valueL += element.offsetLeft || 0;
      element = element.offsetParent;
      if (element) {
        if (isBody(element)) break;
        var p = Element.getStyle(element, 'position');
        if (p !== 'static') break;
      }
    } while (element);

    valueL -= layout.get('margin-top');
    valueT -= layout.get('margin-left');

    return new Element.Offset(valueL, valueT);
  }

  function cumulativeScrollOffset(element) {
    var valueT = 0, valueL = 0;
    do {
      valueT += element.scrollTop  || 0;
      valueL += element.scrollLeft || 0;
      element = element.parentNode;
    } while (element);
    return new Element.Offset(valueL, valueT);
  }

  function viewportOffset(forElement) {
    element = $(element);
    var valueT = 0, valueL = 0, docBody = document.body;

    var element = forElement;
    do {
      valueT += element.offsetTop  || 0;
      valueL += element.offsetLeft || 0;
      if (element.offsetParent == docBody &&
        Element.getStyle(element, 'position') == 'absolute') break;
    } while (element = element.offsetParent);

    element = forElement;
    do {
      if (element != docBody) {
        valueT -= element.scrollTop  || 0;
        valueL -= element.scrollLeft || 0;
      }
    } while (element = element.parentNode);
    return new Element.Offset(valueL, valueT);
  }

  function absolutize(element) {
    element = $(element);

    if (Element.getStyle(element, 'position') === 'absolute') {
      return element;
    }

    var offsetParent = getOffsetParent(element);
    var eOffset = element.viewportOffset(),
     pOffset = offsetParent.viewportOffset();

    var offset = eOffset.relativeTo(pOffset);
    var layout = element.getLayout();

    element.store('prototype_absolutize_original_styles', {
      left:   element.getStyle('left'),
      top:    element.getStyle('top'),
      width:  element.getStyle('width'),
      height: element.getStyle('height')
    });

    element.setStyle({
      position: 'absolute',
      top:    offset.top + 'px',
      left:   offset.left + 'px',
      width:  layout.get('width') + 'px',
      height: layout.get('height') + 'px'
    });

    return element;
  }

  function relativize(element) {
    element = $(element);
    if (Element.getStyle(element, 'position') === 'relative') {
      return element;
    }

    var originalStyles =
     element.retrieve('prototype_absolutize_original_styles');

    if (originalStyles) element.setStyle(originalStyles);
    return element;
  }

  if (Prototype.Browser.IE) {
    getOffsetParent = getOffsetParent.wrap(
      function(proceed, element) {
        element = $(element);

        if (isDocument(element) || isDetached(element) || isBody(element) || isHtml(element))
          return $(document.body);

        var position = element.getStyle('position');
        if (position !== 'static') return proceed(element);

        element.setStyle({ position: 'relative' });
        var value = proceed(element);
        element.setStyle({ position: position });
        return value;
      }
    );

    positionedOffset = positionedOffset.wrap(function(proceed, element) {
      element = $(element);
      if (!element.parentNode) return new Element.Offset(0, 0);
      var position = element.getStyle('position');
      if (position !== 'static') return proceed(element);

      var offsetParent = element.getOffsetParent();
      if (offsetParent && offsetParent.getStyle('position') === 'fixed')
        hasLayout(offsetParent);

      element.setStyle({ position: 'relative' });
      var value = proceed(element);
      element.setStyle({ position: position });
      return value;
    });
  } else if (Prototype.Browser.Webkit) {
    cumulativeOffset = function(element) {
      element = $(element);
      var valueT = 0, valueL = 0;
      do {
        valueT += element.offsetTop  || 0;
        valueL += element.offsetLeft || 0;
        if (element.offsetParent == document.body)
          if (Element.getStyle(element, 'position') == 'absolute') break;

        element = element.offsetParent;
      } while (element);

      return new Element.Offset(valueL, valueT);
    };
  }


  Element.addMethods({
    getLayout:              getLayout,
    measure:                measure,
    getDimensions:          getDimensions,
    getOffsetParent:        getOffsetParent,
    cumulativeOffset:       cumulativeOffset,
    positionedOffset:       positionedOffset,
    cumulativeScrollOffset: cumulativeScrollOffset,
    viewportOffset:         viewportOffset,
    absolutize:             absolutize,
    relativize:             relativize
  });

  function isBody(element) {
    return element.nodeName.toUpperCase() === 'BODY';
  }

  function isHtml(element) {
    return element.nodeName.toUpperCase() === 'HTML';
  }

  function isDocument(element) {
    return element.nodeType === Node.DOCUMENT_NODE;
  }

  function isDetached(element) {
    return element !== document.body &&
     !Element.descendantOf(element, document.body);
  }

  if ('getBoundingClientRect' in document.documentElement) {
    Element.addMethods({
      viewportOffset: function(element) {
        element = $(element);
        if (isDetached(element)) return new Element.Offset(0, 0);

        var rect = element.getBoundingClientRect(),
         docEl = document.documentElement;
        return new Element.Offset(rect.left - docEl.clientLeft,
         rect.top - docEl.clientTop);
      }
    });
  }
})();
window.$$ = function() {
  var expression = $A(arguments).join(', ');
  return Prototype.Selector.select(expression, document);
};

Prototype.Selector = (function() {

  function select() {
    throw new Error('Method "Prototype.Selector.select" must be defined.');
  }

  function match() {
    throw new Error('Method "Prototype.Selector.match" must be defined.');
  }

  function find(elements, expression, index) {
    index = index || 0;
    var match = Prototype.Selector.match, length = elements.length, matchIndex = 0, i;

    for (i = 0; i < length; i++) {
      if (match(elements[i], expression) && index == matchIndex++) {
        return Element.extend(elements[i]);
      }
    }
  }

  function extendElements(elements) {
    for (var i = 0, length = elements.length; i < length; i++) {
      Element.extend(elements[i]);
    }
    return elements;
  }


  var K = Prototype.K;

  return {
    select: select,
    match: match,
    find: find,
    extendElements: (Element.extend === K) ? K : extendElements,
    extendElement: Element.extend
  };
})();
Prototype._original_property = window.Sizzle;
/*!
 * Sizzle CSS Selector Engine - v1.0
 *  Copyright 2009, The Dojo Foundation
 *  Released under the MIT, BSD, and GPL Licenses.
 *  More information: http://sizzlejs.com/
 */
(function(){

var chunker = /((?:\((?:\([^()]+\)|[^()]+)+\)|\[(?:\[[^[\]]*\]|['"][^'"]*['"]|[^[\]'"]+)+\]|\\.|[^ >+~,(\[\\]+)+|[>+~])(\s*,\s*)?((?:.|\r|\n)*)/g,
	done = 0,
	toString = Object.prototype.toString,
	hasDuplicate = false,
	baseHasDuplicate = true;

[0, 0].sort(function(){
	baseHasDuplicate = false;
	return 0;
});

var Sizzle = function(selector, context, results, seed) {
	results = results || [];
	var origContext = context = context || document;

	if ( context.nodeType !== 1 && context.nodeType !== 9 ) {
		return [];
	}

	if ( !selector || typeof selector !== "string" ) {
		return results;
	}

	var parts = [], m, set, checkSet, check, mode, extra, prune = true, contextXML = isXML(context),
		soFar = selector;

	while ( (chunker.exec(""), m = chunker.exec(soFar)) !== null ) {
		soFar = m[3];

		parts.push( m[1] );

		if ( m[2] ) {
			extra = m[3];
			break;
		}
	}

	if ( parts.length > 1 && origPOS.exec( selector ) ) {
		if ( parts.length === 2 && Expr.relative[ parts[0] ] ) {
			set = posProcess( parts[0] + parts[1], context );
		} else {
			set = Expr.relative[ parts[0] ] ?
				[ context ] :
				Sizzle( parts.shift(), context );

			while ( parts.length ) {
				selector = parts.shift();

				if ( Expr.relative[ selector ] )
					selector += parts.shift();

				set = posProcess( selector, set );
			}
		}
	} else {
		if ( !seed && parts.length > 1 && context.nodeType === 9 && !contextXML &&
				Expr.match.ID.test(parts[0]) && !Expr.match.ID.test(parts[parts.length - 1]) ) {
			var ret = Sizzle.find( parts.shift(), context, contextXML );
			context = ret.expr ? Sizzle.filter( ret.expr, ret.set )[0] : ret.set[0];
		}

		if ( context ) {
			var ret = seed ?
				{ expr: parts.pop(), set: makeArray(seed) } :
				Sizzle.find( parts.pop(), parts.length === 1 && (parts[0] === "~" || parts[0] === "+") && context.parentNode ? context.parentNode : context, contextXML );
			set = ret.expr ? Sizzle.filter( ret.expr, ret.set ) : ret.set;

			if ( parts.length > 0 ) {
				checkSet = makeArray(set);
			} else {
				prune = false;
			}

			while ( parts.length ) {
				var cur = parts.pop(), pop = cur;

				if ( !Expr.relative[ cur ] ) {
					cur = "";
				} else {
					pop = parts.pop();
				}

				if ( pop == null ) {
					pop = context;
				}

				Expr.relative[ cur ]( checkSet, pop, contextXML );
			}
		} else {
			checkSet = parts = [];
		}
	}

	if ( !checkSet ) {
		checkSet = set;
	}

	if ( !checkSet ) {
		throw "Syntax error, unrecognized expression: " + (cur || selector);
	}

	if ( toString.call(checkSet) === "[object Array]" ) {
		if ( !prune ) {
			results.push.apply( results, checkSet );
		} else if ( context && context.nodeType === 1 ) {
			for ( var i = 0; checkSet[i] != null; i++ ) {
				if ( checkSet[i] && (checkSet[i] === true || checkSet[i].nodeType === 1 && contains(context, checkSet[i])) ) {
					results.push( set[i] );
				}
			}
		} else {
			for ( var i = 0; checkSet[i] != null; i++ ) {
				if ( checkSet[i] && checkSet[i].nodeType === 1 ) {
					results.push( set[i] );
				}
			}
		}
	} else {
		makeArray( checkSet, results );
	}

	if ( extra ) {
		Sizzle( extra, origContext, results, seed );
		Sizzle.uniqueSort( results );
	}

	return results;
};

Sizzle.uniqueSort = function(results){
	if ( sortOrder ) {
		hasDuplicate = baseHasDuplicate;
		results.sort(sortOrder);

		if ( hasDuplicate ) {
			for ( var i = 1; i < results.length; i++ ) {
				if ( results[i] === results[i-1] ) {
					results.splice(i--, 1);
				}
			}
		}
	}

	return results;
};

Sizzle.matches = function(expr, set){
	return Sizzle(expr, null, null, set);
};

Sizzle.find = function(expr, context, isXML){
	var set, match;

	if ( !expr ) {
		return [];
	}

	for ( var i = 0, l = Expr.order.length; i < l; i++ ) {
		var type = Expr.order[i], match;

		if ( (match = Expr.leftMatch[ type ].exec( expr )) ) {
			var left = match[1];
			match.splice(1,1);

			if ( left.substr( left.length - 1 ) !== "\\" ) {
				match[1] = (match[1] || "").replace(/\\/g, "");
				set = Expr.find[ type ]( match, context, isXML );
				if ( set != null ) {
					expr = expr.replace( Expr.match[ type ], "" );
					break;
				}
			}
		}
	}

	if ( !set ) {
		set = context.getElementsByTagName("*");
	}

	return {set: set, expr: expr};
};

Sizzle.filter = function(expr, set, inplace, not){
	var old = expr, result = [], curLoop = set, match, anyFound,
		isXMLFilter = set && set[0] && isXML(set[0]);

	while ( expr && set.length ) {
		for ( var type in Expr.filter ) {
			if ( (match = Expr.match[ type ].exec( expr )) != null ) {
				var filter = Expr.filter[ type ], found, item;
				anyFound = false;

				if ( curLoop == result ) {
					result = [];
				}

				if ( Expr.preFilter[ type ] ) {
					match = Expr.preFilter[ type ]( match, curLoop, inplace, result, not, isXMLFilter );

					if ( !match ) {
						anyFound = found = true;
					} else if ( match === true ) {
						continue;
					}
				}

				if ( match ) {
					for ( var i = 0; (item = curLoop[i]) != null; i++ ) {
						if ( item ) {
							found = filter( item, match, i, curLoop );
							var pass = not ^ !!found;

							if ( inplace && found != null ) {
								if ( pass ) {
									anyFound = true;
								} else {
									curLoop[i] = false;
								}
							} else if ( pass ) {
								result.push( item );
								anyFound = true;
							}
						}
					}
				}

				if ( found !== undefined ) {
					if ( !inplace ) {
						curLoop = result;
					}

					expr = expr.replace( Expr.match[ type ], "" );

					if ( !anyFound ) {
						return [];
					}

					break;
				}
			}
		}

		if ( expr == old ) {
			if ( anyFound == null ) {
				throw "Syntax error, unrecognized expression: " + expr;
			} else {
				break;
			}
		}

		old = expr;
	}

	return curLoop;
};

var Expr = Sizzle.selectors = {
	order: [ "ID", "NAME", "TAG" ],
	match: {
		ID: /#((?:[\w\u00c0-\uFFFF-]|\\.)+)/,
		CLASS: /\.((?:[\w\u00c0-\uFFFF-]|\\.)+)/,
		NAME: /\[name=['"]*((?:[\w\u00c0-\uFFFF-]|\\.)+)['"]*\]/,
		ATTR: /\[\s*((?:[\w\u00c0-\uFFFF-]|\\.)+)\s*(?:(\S?=)\s*(['"]*)(.*?)\3|)\s*\]/,
		TAG: /^((?:[\w\u00c0-\uFFFF\*-]|\\.)+)/,
		CHILD: /:(only|nth|last|first)-child(?:\((even|odd|[\dn+-]*)\))?/,
		POS: /:(nth|eq|gt|lt|first|last|even|odd)(?:\((\d*)\))?(?=[^-]|$)/,
		PSEUDO: /:((?:[\w\u00c0-\uFFFF-]|\\.)+)(?:\((['"]*)((?:\([^\)]+\)|[^\2\(\)]*)+)\2\))?/
	},
	leftMatch: {},
	attrMap: {
		"class": "className",
		"for": "htmlFor"
	},
	attrHandle: {
		href: function(elem){
			return elem.getAttribute("href");
		}
	},
	relative: {
		"+": function(checkSet, part, isXML){
			var isPartStr = typeof part === "string",
				isTag = isPartStr && !/\W/.test(part),
				isPartStrNotTag = isPartStr && !isTag;

			if ( isTag && !isXML ) {
				part = part.toUpperCase();
			}

			for ( var i = 0, l = checkSet.length, elem; i < l; i++ ) {
				if ( (elem = checkSet[i]) ) {
					while ( (elem = elem.previousSibling) && elem.nodeType !== 1 ) {}

					checkSet[i] = isPartStrNotTag || elem && elem.nodeName === part ?
						elem || false :
						elem === part;
				}
			}

			if ( isPartStrNotTag ) {
				Sizzle.filter( part, checkSet, true );
			}
		},
		">": function(checkSet, part, isXML){
			var isPartStr = typeof part === "string";

			if ( isPartStr && !/\W/.test(part) ) {
				part = isXML ? part : part.toUpperCase();

				for ( var i = 0, l = checkSet.length; i < l; i++ ) {
					var elem = checkSet[i];
					if ( elem ) {
						var parent = elem.parentNode;
						checkSet[i] = parent.nodeName === part ? parent : false;
					}
				}
			} else {
				for ( var i = 0, l = checkSet.length; i < l; i++ ) {
					var elem = checkSet[i];
					if ( elem ) {
						checkSet[i] = isPartStr ?
							elem.parentNode :
							elem.parentNode === part;
					}
				}

				if ( isPartStr ) {
					Sizzle.filter( part, checkSet, true );
				}
			}
		},
		"": function(checkSet, part, isXML){
			var doneName = done++, checkFn = dirCheck;

			if ( !/\W/.test(part) ) {
				var nodeCheck = part = isXML ? part : part.toUpperCase();
				checkFn = dirNodeCheck;
			}

			checkFn("parentNode", part, doneName, checkSet, nodeCheck, isXML);
		},
		"~": function(checkSet, part, isXML){
			var doneName = done++, checkFn = dirCheck;

			if ( typeof part === "string" && !/\W/.test(part) ) {
				var nodeCheck = part = isXML ? part : part.toUpperCase();
				checkFn = dirNodeCheck;
			}

			checkFn("previousSibling", part, doneName, checkSet, nodeCheck, isXML);
		}
	},
	find: {
		ID: function(match, context, isXML){
			if ( typeof context.getElementById !== "undefined" && !isXML ) {
				var m = context.getElementById(match[1]);
				return m ? [m] : [];
			}
		},
		NAME: function(match, context, isXML){
			if ( typeof context.getElementsByName !== "undefined" ) {
				var ret = [], results = context.getElementsByName(match[1]);

				for ( var i = 0, l = results.length; i < l; i++ ) {
					if ( results[i].getAttribute("name") === match[1] ) {
						ret.push( results[i] );
					}
				}

				return ret.length === 0 ? null : ret;
			}
		},
		TAG: function(match, context){
			return context.getElementsByTagName(match[1]);
		}
	},
	preFilter: {
		CLASS: function(match, curLoop, inplace, result, not, isXML){
			match = " " + match[1].replace(/\\/g, "") + " ";

			if ( isXML ) {
				return match;
			}

			for ( var i = 0, elem; (elem = curLoop[i]) != null; i++ ) {
				if ( elem ) {
					if ( not ^ (elem.className && (" " + elem.className + " ").indexOf(match) >= 0) ) {
						if ( !inplace )
							result.push( elem );
					} else if ( inplace ) {
						curLoop[i] = false;
					}
				}
			}

			return false;
		},
		ID: function(match){
			return match[1].replace(/\\/g, "");
		},
		TAG: function(match, curLoop){
			for ( var i = 0; curLoop[i] === false; i++ ){}
			return curLoop[i] && isXML(curLoop[i]) ? match[1] : match[1].toUpperCase();
		},
		CHILD: function(match){
			if ( match[1] == "nth" ) {
				var test = /(-?)(\d*)n((?:\+|-)?\d*)/.exec(
					match[2] == "even" && "2n" || match[2] == "odd" && "2n+1" ||
					!/\D/.test( match[2] ) && "0n+" + match[2] || match[2]);

				match[2] = (test[1] + (test[2] || 1)) - 0;
				match[3] = test[3] - 0;
			}

			match[0] = done++;

			return match;
		},
		ATTR: function(match, curLoop, inplace, result, not, isXML){
			var name = match[1].replace(/\\/g, "");

			if ( !isXML && Expr.attrMap[name] ) {
				match[1] = Expr.attrMap[name];
			}

			if ( match[2] === "~=" ) {
				match[4] = " " + match[4] + " ";
			}

			return match;
		},
		PSEUDO: function(match, curLoop, inplace, result, not){
			if ( match[1] === "not" ) {
				if ( ( chunker.exec(match[3]) || "" ).length > 1 || /^\w/.test(match[3]) ) {
					match[3] = Sizzle(match[3], null, null, curLoop);
				} else {
					var ret = Sizzle.filter(match[3], curLoop, inplace, true ^ not);
					if ( !inplace ) {
						result.push.apply( result, ret );
					}
					return false;
				}
			} else if ( Expr.match.POS.test( match[0] ) || Expr.match.CHILD.test( match[0] ) ) {
				return true;
			}

			return match;
		},
		POS: function(match){
			match.unshift( true );
			return match;
		}
	},
	filters: {
		enabled: function(elem){
			return elem.disabled === false && elem.type !== "hidden";
		},
		disabled: function(elem){
			return elem.disabled === true;
		},
		checked: function(elem){
			return elem.checked === true;
		},
		selected: function(elem){
			elem.parentNode.selectedIndex;
			return elem.selected === true;
		},
		parent: function(elem){
			return !!elem.firstChild;
		},
		empty: function(elem){
			return !elem.firstChild;
		},
		has: function(elem, i, match){
			return !!Sizzle( match[3], elem ).length;
		},
		header: function(elem){
			return /h\d/i.test( elem.nodeName );
		},
		text: function(elem){
			return "text" === elem.type;
		},
		radio: function(elem){
			return "radio" === elem.type;
		},
		checkbox: function(elem){
			return "checkbox" === elem.type;
		},
		file: function(elem){
			return "file" === elem.type;
		},
		password: function(elem){
			return "password" === elem.type;
		},
		submit: function(elem){
			return "submit" === elem.type;
		},
		image: function(elem){
			return "image" === elem.type;
		},
		reset: function(elem){
			return "reset" === elem.type;
		},
		button: function(elem){
			return "button" === elem.type || elem.nodeName.toUpperCase() === "BUTTON";
		},
		input: function(elem){
			return /input|select|textarea|button/i.test(elem.nodeName);
		}
	},
	setFilters: {
		first: function(elem, i){
			return i === 0;
		},
		last: function(elem, i, match, array){
			return i === array.length - 1;
		},
		even: function(elem, i){
			return i % 2 === 0;
		},
		odd: function(elem, i){
			return i % 2 === 1;
		},
		lt: function(elem, i, match){
			return i < match[3] - 0;
		},
		gt: function(elem, i, match){
			return i > match[3] - 0;
		},
		nth: function(elem, i, match){
			return match[3] - 0 == i;
		},
		eq: function(elem, i, match){
			return match[3] - 0 == i;
		}
	},
	filter: {
		PSEUDO: function(elem, match, i, array){
			var name = match[1], filter = Expr.filters[ name ];

			if ( filter ) {
				return filter( elem, i, match, array );
			} else if ( name === "contains" ) {
				return (elem.textContent || elem.innerText || "").indexOf(match[3]) >= 0;
			} else if ( name === "not" ) {
				var not = match[3];

				for ( var i = 0, l = not.length; i < l; i++ ) {
					if ( not[i] === elem ) {
						return false;
					}
				}

				return true;
			}
		},
		CHILD: function(elem, match){
			var type = match[1], node = elem;
			switch (type) {
				case 'only':
				case 'first':
					while ( (node = node.previousSibling) )  {
						if ( node.nodeType === 1 ) return false;
					}
					if ( type == 'first') return true;
					node = elem;
				case 'last':
					while ( (node = node.nextSibling) )  {
						if ( node.nodeType === 1 ) return false;
					}
					return true;
				case 'nth':
					var first = match[2], last = match[3];

					if ( first == 1 && last == 0 ) {
						return true;
					}

					var doneName = match[0],
						parent = elem.parentNode;

					if ( parent && (parent.sizcache !== doneName || !elem.nodeIndex) ) {
						var count = 0;
						for ( node = parent.firstChild; node; node = node.nextSibling ) {
							if ( node.nodeType === 1 ) {
								node.nodeIndex = ++count;
							}
						}
						parent.sizcache = doneName;
					}

					var diff = elem.nodeIndex - last;
					if ( first == 0 ) {
						return diff == 0;
					} else {
						return ( diff % first == 0 && diff / first >= 0 );
					}
			}
		},
		ID: function(elem, match){
			return elem.nodeType === 1 && elem.getAttribute("id") === match;
		},
		TAG: function(elem, match){
			return (match === "*" && elem.nodeType === 1) || elem.nodeName === match;
		},
		CLASS: function(elem, match){
			return (" " + (elem.className || elem.getAttribute("class")) + " ")
				.indexOf( match ) > -1;
		},
		ATTR: function(elem, match){
			var name = match[1],
				result = Expr.attrHandle[ name ] ?
					Expr.attrHandle[ name ]( elem ) :
					elem[ name ] != null ?
						elem[ name ] :
						elem.getAttribute( name ),
				value = result + "",
				type = match[2],
				check = match[4];

			return result == null ?
				type === "!=" :
				type === "=" ?
				value === check :
				type === "*=" ?
				value.indexOf(check) >= 0 :
				type === "~=" ?
				(" " + value + " ").indexOf(check) >= 0 :
				!check ?
				value && result !== false :
				type === "!=" ?
				value != check :
				type === "^=" ?
				value.indexOf(check) === 0 :
				type === "$=" ?
				value.substr(value.length - check.length) === check :
				type === "|=" ?
				value === check || value.substr(0, check.length + 1) === check + "-" :
				false;
		},
		POS: function(elem, match, i, array){
			var name = match[2], filter = Expr.setFilters[ name ];

			if ( filter ) {
				return filter( elem, i, match, array );
			}
		}
	}
};

var origPOS = Expr.match.POS;

for ( var type in Expr.match ) {
	Expr.match[ type ] = new RegExp( Expr.match[ type ].source + /(?![^\[]*\])(?![^\(]*\))/.source );
	Expr.leftMatch[ type ] = new RegExp( /(^(?:.|\r|\n)*?)/.source + Expr.match[ type ].source );
}

var makeArray = function(array, results) {
	array = Array.prototype.slice.call( array, 0 );

	if ( results ) {
		results.push.apply( results, array );
		return results;
	}

	return array;
};

try {
	Array.prototype.slice.call( document.documentElement.childNodes, 0 );

} catch(e){
	makeArray = function(array, results) {
		var ret = results || [];

		if ( toString.call(array) === "[object Array]" ) {
			Array.prototype.push.apply( ret, array );
		} else {
			if ( typeof array.length === "number" ) {
				for ( var i = 0, l = array.length; i < l; i++ ) {
					ret.push( array[i] );
				}
			} else {
				for ( var i = 0; array[i]; i++ ) {
					ret.push( array[i] );
				}
			}
		}

		return ret;
	};
}

var sortOrder;

if ( document.documentElement.compareDocumentPosition ) {
	sortOrder = function( a, b ) {
		if ( !a.compareDocumentPosition || !b.compareDocumentPosition ) {
			if ( a == b ) {
				hasDuplicate = true;
			}
			return 0;
		}

		var ret = a.compareDocumentPosition(b) & 4 ? -1 : a === b ? 0 : 1;
		if ( ret === 0 ) {
			hasDuplicate = true;
		}
		return ret;
	};
} else if ( "sourceIndex" in document.documentElement ) {
	sortOrder = function( a, b ) {
		if ( !a.sourceIndex || !b.sourceIndex ) {
			if ( a == b ) {
				hasDuplicate = true;
			}
			return 0;
		}

		var ret = a.sourceIndex - b.sourceIndex;
		if ( ret === 0 ) {
			hasDuplicate = true;
		}
		return ret;
	};
} else if ( document.createRange ) {
	sortOrder = function( a, b ) {
		if ( !a.ownerDocument || !b.ownerDocument ) {
			if ( a == b ) {
				hasDuplicate = true;
			}
			return 0;
		}

		var aRange = a.ownerDocument.createRange(), bRange = b.ownerDocument.createRange();
		aRange.setStart(a, 0);
		aRange.setEnd(a, 0);
		bRange.setStart(b, 0);
		bRange.setEnd(b, 0);
		var ret = aRange.compareBoundaryPoints(Range.START_TO_END, bRange);
		if ( ret === 0 ) {
			hasDuplicate = true;
		}
		return ret;
	};
}

(function(){
	var form = document.createElement("div"),
		id = "script" + (new Date).getTime();
	form.innerHTML = "<a name='" + id + "'/>";

	var root = document.documentElement;
	root.insertBefore( form, root.firstChild );

	if ( !!document.getElementById( id ) ) {
		Expr.find.ID = function(match, context, isXML){
			if ( typeof context.getElementById !== "undefined" && !isXML ) {
				var m = context.getElementById(match[1]);
				return m ? m.id === match[1] || typeof m.getAttributeNode !== "undefined" && m.getAttributeNode("id").nodeValue === match[1] ? [m] : undefined : [];
			}
		};

		Expr.filter.ID = function(elem, match){
			var node = typeof elem.getAttributeNode !== "undefined" && elem.getAttributeNode("id");
			return elem.nodeType === 1 && node && node.nodeValue === match;
		};
	}

	root.removeChild( form );
	root = form = null; // release memory in IE
})();

(function(){

	var div = document.createElement("div");
	div.appendChild( document.createComment("") );

	if ( div.getElementsByTagName("*").length > 0 ) {
		Expr.find.TAG = function(match, context){
			var results = context.getElementsByTagName(match[1]);

			if ( match[1] === "*" ) {
				var tmp = [];

				for ( var i = 0; results[i]; i++ ) {
					if ( results[i].nodeType === 1 ) {
						tmp.push( results[i] );
					}
				}

				results = tmp;
			}

			return results;
		};
	}

	div.innerHTML = "<a href='#'></a>";
	if ( div.firstChild && typeof div.firstChild.getAttribute !== "undefined" &&
			div.firstChild.getAttribute("href") !== "#" ) {
		Expr.attrHandle.href = function(elem){
			return elem.getAttribute("href", 2);
		};
	}

	div = null; // release memory in IE
})();

if ( document.querySelectorAll ) (function(){
	var oldSizzle = Sizzle, div = document.createElement("div");
	div.innerHTML = "<p class='TEST'></p>";

	if ( div.querySelectorAll && div.querySelectorAll(".TEST").length === 0 ) {
		return;
	}

	Sizzle = function(query, context, extra, seed){
		context = context || document;

		if ( !seed && context.nodeType === 9 && !isXML(context) ) {
			try {
				return makeArray( context.querySelectorAll(query), extra );
			} catch(e){}
		}

		return oldSizzle(query, context, extra, seed);
	};

	for ( var prop in oldSizzle ) {
		Sizzle[ prop ] = oldSizzle[ prop ];
	}

	div = null; // release memory in IE
})();

if ( document.getElementsByClassName && document.documentElement.getElementsByClassName ) (function(){
	var div = document.createElement("div");
	div.innerHTML = "<div class='test e'></div><div class='test'></div>";

	if ( div.getElementsByClassName("e").length === 0 )
		return;

	div.lastChild.className = "e";

	if ( div.getElementsByClassName("e").length === 1 )
		return;

	Expr.order.splice(1, 0, "CLASS");
	Expr.find.CLASS = function(match, context, isXML) {
		if ( typeof context.getElementsByClassName !== "undefined" && !isXML ) {
			return context.getElementsByClassName(match[1]);
		}
	};

	div = null; // release memory in IE
})();

function dirNodeCheck( dir, cur, doneName, checkSet, nodeCheck, isXML ) {
	var sibDir = dir == "previousSibling" && !isXML;
	for ( var i = 0, l = checkSet.length; i < l; i++ ) {
		var elem = checkSet[i];
		if ( elem ) {
			if ( sibDir && elem.nodeType === 1 ){
				elem.sizcache = doneName;
				elem.sizset = i;
			}
			elem = elem[dir];
			var match = false;

			while ( elem ) {
				if ( elem.sizcache === doneName ) {
					match = checkSet[elem.sizset];
					break;
				}

				if ( elem.nodeType === 1 && !isXML ){
					elem.sizcache = doneName;
					elem.sizset = i;
				}

				if ( elem.nodeName === cur ) {
					match = elem;
					break;
				}

				elem = elem[dir];
			}

			checkSet[i] = match;
		}
	}
}

function dirCheck( dir, cur, doneName, checkSet, nodeCheck, isXML ) {
	var sibDir = dir == "previousSibling" && !isXML;
	for ( var i = 0, l = checkSet.length; i < l; i++ ) {
		var elem = checkSet[i];
		if ( elem ) {
			if ( sibDir && elem.nodeType === 1 ) {
				elem.sizcache = doneName;
				elem.sizset = i;
			}
			elem = elem[dir];
			var match = false;

			while ( elem ) {
				if ( elem.sizcache === doneName ) {
					match = checkSet[elem.sizset];
					break;
				}

				if ( elem.nodeType === 1 ) {
					if ( !isXML ) {
						elem.sizcache = doneName;
						elem.sizset = i;
					}
					if ( typeof cur !== "string" ) {
						if ( elem === cur ) {
							match = true;
							break;
						}

					} else if ( Sizzle.filter( cur, [elem] ).length > 0 ) {
						match = elem;
						break;
					}
				}

				elem = elem[dir];
			}

			checkSet[i] = match;
		}
	}
}

var contains = document.compareDocumentPosition ?  function(a, b){
	return a.compareDocumentPosition(b) & 16;
} : function(a, b){
	return a !== b && (a.contains ? a.contains(b) : true);
};

var isXML = function(elem){
	return elem.nodeType === 9 && elem.documentElement.nodeName !== "HTML" ||
		!!elem.ownerDocument && elem.ownerDocument.documentElement.nodeName !== "HTML";
};

var posProcess = function(selector, context){
	var tmpSet = [], later = "", match,
		root = context.nodeType ? [context] : context;

	while ( (match = Expr.match.PSEUDO.exec( selector )) ) {
		later += match[0];
		selector = selector.replace( Expr.match.PSEUDO, "" );
	}

	selector = Expr.relative[selector] ? selector + "*" : selector;

	for ( var i = 0, l = root.length; i < l; i++ ) {
		Sizzle( selector, root[i], tmpSet );
	}

	return Sizzle.filter( later, tmpSet );
};


window.Sizzle = Sizzle;

})();

;(function(engine) {
  var extendElements = Prototype.Selector.extendElements;

  function select(selector, scope) {
    return extendElements(engine(selector, scope || document));
  }

  function match(element, selector) {
    return engine.matches(selector, [element]).length == 1;
  }

  Prototype.Selector.engine = engine;
  Prototype.Selector.select = select;
  Prototype.Selector.match = match;
})(Sizzle);

window.Sizzle = Prototype._original_property;
delete Prototype._original_property;

var Form = {
  reset: function(form) {
    form = $(form);
    form.reset();
    return form;
  },

  serializeElements: function(elements, options) {
    if (typeof options != 'object') options = { hash: !!options };
    else if (Object.isUndefined(options.hash)) options.hash = true;
    var key, value, submitted = false, submit = options.submit, accumulator, initial;

    if (options.hash) {
      initial = {};
      accumulator = function(result, key, value) {
        if (key in result) {
          if (!Object.isArray(result[key])) result[key] = [result[key]];
          result[key].push(value);
        } else result[key] = value;
        return result;
      };
    } else {
      initial = '';
      accumulator = function(result, key, value) {
        return result + (result ? '&' : '') + encodeURIComponent(key) + '=' + encodeURIComponent(value);
      }
    }

    return elements.inject(initial, function(result, element) {
      if (!element.disabled && element.name) {
        key = element.name; value = $(element).getValue();
        if (value != null && element.type != 'file' && (element.type != 'submit' || (!submitted &&
            submit !== false && (!submit || key == submit) && (submitted = true)))) {
          result = accumulator(result, key, value);
        }
      }
      return result;
    });
  }
};

Form.Methods = {
  serialize: function(form, options) {
    return Form.serializeElements(Form.getElements(form), options);
  },

  getElements: function(form) {
    var elements = $(form).getElementsByTagName('*'),
        element,
        arr = [ ],
        serializers = Form.Element.Serializers;
    for (var i = 0; element = elements[i]; i++) {
      arr.push(element);
    }
    return arr.inject([], function(elements, child) {
      if (serializers[child.tagName.toLowerCase()])
        elements.push(Element.extend(child));
      return elements;
    })
  },

  getInputs: function(form, typeName, name) {
    form = $(form);
    var inputs = form.getElementsByTagName('input');

    if (!typeName && !name) return $A(inputs).map(Element.extend);

    for (var i = 0, matchingInputs = [], length = inputs.length; i < length; i++) {
      var input = inputs[i];
      if ((typeName && input.type != typeName) || (name && input.name != name))
        continue;
      matchingInputs.push(Element.extend(input));
    }

    return matchingInputs;
  },

  disable: function(form) {
    form = $(form);
    Form.getElements(form).invoke('disable');
    return form;
  },

  enable: function(form) {
    form = $(form);
    Form.getElements(form).invoke('enable');
    return form;
  },

  findFirstElement: function(form) {
    var elements = $(form).getElements().findAll(function(element) {
      return 'hidden' != element.type && !element.disabled;
    });
    var firstByIndex = elements.findAll(function(element) {
      return element.hasAttribute('tabIndex') && element.tabIndex >= 0;
    }).sortBy(function(element) { return element.tabIndex }).first();

    return firstByIndex ? firstByIndex : elements.find(function(element) {
      return /^(?:input|select|textarea)$/i.test(element.tagName);
    });
  },

  focusFirstElement: function(form) {
    form = $(form);
    var element = form.findFirstElement();
    if (element) element.activate();
    return form;
  },

  request: function(form, options) {
    form = $(form), options = Object.clone(options || { });

    var params = options.parameters, action = form.readAttribute('action') || '';
    if (action.blank()) action = window.location.href;
    options.parameters = form.serialize(true);

    if (params) {
      if (Object.isString(params)) params = params.toQueryParams();
      Object.extend(options.parameters, params);
    }

    if (form.hasAttribute('method') && !options.method)
      options.method = form.method;

    return new Ajax.Request(action, options);
  }
};

/*--------------------------------------------------------------------------*/


Form.Element = {
  focus: function(element) {
    $(element).focus();
    return element;
  },

  select: function(element) {
    $(element).select();
    return element;
  }
};

Form.Element.Methods = {

  serialize: function(element) {
    element = $(element);
    if (!element.disabled && element.name) {
      var value = element.getValue();
      if (value != undefined) {
        var pair = { };
        pair[element.name] = value;
        return Object.toQueryString(pair);
      }
    }
    return '';
  },

  getValue: function(element) {
    element = $(element);
    var method = element.tagName.toLowerCase();
    return Form.Element.Serializers[method](element);
  },

  setValue: function(element, value) {
    element = $(element);
    var method = element.tagName.toLowerCase();
    Form.Element.Serializers[method](element, value);
    return element;
  },

  clear: function(element) {
    $(element).value = '';
    return element;
  },

  present: function(element) {
    return $(element).value != '';
  },

  activate: function(element) {
    element = $(element);
    try {
      element.focus();
      if (element.select && (element.tagName.toLowerCase() != 'input' ||
          !(/^(?:button|reset|submit)$/i.test(element.type))))
        element.select();
    } catch (e) { }
    return element;
  },

  disable: function(element) {
    element = $(element);
    element.disabled = true;
    return element;
  },

  enable: function(element) {
    element = $(element);
    element.disabled = false;
    return element;
  }
};

/*--------------------------------------------------------------------------*/

var Field = Form.Element;

var $F = Form.Element.Methods.getValue;

/*--------------------------------------------------------------------------*/

Form.Element.Serializers = (function() {
  function input(element, value) {
    switch (element.type.toLowerCase()) {
      case 'checkbox':
      case 'radio':
        return inputSelector(element, value);
      default:
        return valueSelector(element, value);
    }
  }

  function inputSelector(element, value) {
    if (Object.isUndefined(value))
      return element.checked ? element.value : null;
    else element.checked = !!value;
  }

  function valueSelector(element, value) {
    if (Object.isUndefined(value)) return element.value;
    else element.value = value;
  }

  function select(element, value) {
    if (Object.isUndefined(value))
      return (element.type === 'select-one' ? selectOne : selectMany)(element);

    var opt, currentValue, single = !Object.isArray(value);
    for (var i = 0, length = element.length; i < length; i++) {
      opt = element.options[i];
      currentValue = this.optionValue(opt);
      if (single) {
        if (currentValue == value) {
          opt.selected = true;
          return;
        }
      }
      else opt.selected = value.include(currentValue);
    }
  }

  function selectOne(element) {
    var index = element.selectedIndex;
    return index >= 0 ? optionValue(element.options[index]) : null;
  }

  function selectMany(element) {
    var values, length = element.length;
    if (!length) return null;

    for (var i = 0, values = []; i < length; i++) {
      var opt = element.options[i];
      if (opt.selected) values.push(optionValue(opt));
    }
    return values;
  }

  function optionValue(opt) {
    return Element.hasAttribute(opt, 'value') ? opt.value : opt.text;
  }

  return {
    input:         input,
    inputSelector: inputSelector,
    textarea:      valueSelector,
    select:        select,
    selectOne:     selectOne,
    selectMany:    selectMany,
    optionValue:   optionValue,
    button:        valueSelector
  };
})();

/*--------------------------------------------------------------------------*/


Abstract.TimedObserver = Class.create(PeriodicalExecuter, {
  initialize: function($super, element, frequency, callback) {
    $super(callback, frequency);
    this.element   = $(element);
    this.lastValue = this.getValue();
  },

  execute: function() {
    var value = this.getValue();
    if (Object.isString(this.lastValue) && Object.isString(value) ?
        this.lastValue != value : String(this.lastValue) != String(value)) {
      this.callback(this.element, value);
      this.lastValue = value;
    }
  }
});

Form.Element.Observer = Class.create(Abstract.TimedObserver, {
  getValue: function() {
    return Form.Element.getValue(this.element);
  }
});

Form.Observer = Class.create(Abstract.TimedObserver, {
  getValue: function() {
    return Form.serialize(this.element);
  }
});

/*--------------------------------------------------------------------------*/

Abstract.EventObserver = Class.create({
  initialize: function(element, callback) {
    this.element  = $(element);
    this.callback = callback;

    this.lastValue = this.getValue();
    if (this.element.tagName.toLowerCase() == 'form')
      this.registerFormCallbacks();
    else
      this.registerCallback(this.element);
  },

  onElementEvent: function() {
    var value = this.getValue();
    if (this.lastValue != value) {
      this.callback(this.element, value);
      this.lastValue = value;
    }
  },

  registerFormCallbacks: function() {
    Form.getElements(this.element).each(this.registerCallback, this);
  },

  registerCallback: function(element) {
    if (element.type) {
      switch (element.type.toLowerCase()) {
        case 'checkbox':
        case 'radio':
          Event.observe(element, 'click', this.onElementEvent.bind(this));
          break;
        default:
          Event.observe(element, 'change', this.onElementEvent.bind(this));
          break;
      }
    }
  }
});

Form.Element.EventObserver = Class.create(Abstract.EventObserver, {
  getValue: function() {
    return Form.Element.getValue(this.element);
  }
});

Form.EventObserver = Class.create(Abstract.EventObserver, {
  getValue: function() {
    return Form.serialize(this.element);
  }
});
(function() {

  var Event = {
    KEY_BACKSPACE: 8,
    KEY_TAB:       9,
    KEY_RETURN:   13,
    KEY_ESC:      27,
    KEY_LEFT:     37,
    KEY_UP:       38,
    KEY_RIGHT:    39,
    KEY_DOWN:     40,
    KEY_DELETE:   46,
    KEY_HOME:     36,
    KEY_END:      35,
    KEY_PAGEUP:   33,
    KEY_PAGEDOWN: 34,
    KEY_INSERT:   45,

    cache: {}
  };

  var docEl = document.documentElement;
  var MOUSEENTER_MOUSELEAVE_EVENTS_SUPPORTED = 'onmouseenter' in docEl
    && 'onmouseleave' in docEl;



  var isIELegacyEvent = function(event) { return false; };

  if (window.attachEvent) {
    if (window.addEventListener) {
      isIELegacyEvent = function(event) {
        return !(event instanceof window.Event);
      };
    } else {
      isIELegacyEvent = function(event) { return true; };
    }
  }

  var _isButton;

  function _isButtonForDOMEvents(event, code) {
    return event.which ? (event.which === code + 1) : (event.button === code);
  }

  var legacyButtonMap = { 0: 1, 1: 4, 2: 2 };
  function _isButtonForLegacyEvents(event, code) {
    return event.button === legacyButtonMap[code];
  }

  function _isButtonForWebKit(event, code) {
    switch (code) {
      case 0: return event.which == 1 && !event.metaKey;
      case 1: return event.which == 2 || (event.which == 1 && event.metaKey);
      case 2: return event.which == 3;
      default: return false;
    }
  }

  if (window.attachEvent) {
    if (!window.addEventListener) {
      _isButton = _isButtonForLegacyEvents;
    } else {
      _isButton = function(event, code) {
        return isIELegacyEvent(event) ? _isButtonForLegacyEvents(event, code) :
         _isButtonForDOMEvents(event, code);
      }
    }
  } else if (Prototype.Browser.WebKit) {
    _isButton = _isButtonForWebKit;
  } else {
    _isButton = _isButtonForDOMEvents;
  }

  function isLeftClick(event)   { return _isButton(event, 0) }

  function isMiddleClick(event) { return _isButton(event, 1) }

  function isRightClick(event)  { return _isButton(event, 2) }

  function element(event) {
    event = Event.extend(event);

    var node = event.target, type = event.type,
     currentTarget = event.currentTarget;

    if (currentTarget && currentTarget.tagName) {
      if (type === 'load' || type === 'error' ||
        (type === 'click' && currentTarget.tagName.toLowerCase() === 'input'
          && currentTarget.type === 'radio'))
            node = currentTarget;
    }

    if (node.nodeType == Node.TEXT_NODE)
      node = node.parentNode;

    return Element.extend(node);
  }

  function findElement(event, expression) {
    var element = Event.element(event);

    if (!expression) return element;
    while (element) {
      if (Object.isElement(element) && Prototype.Selector.match(element, expression)) {
        return Element.extend(element);
      }
      element = element.parentNode;
    }
  }

  function pointer(event) {
    return { x: pointerX(event), y: pointerY(event) };
  }

  function pointerX(event) {
    var docElement = document.documentElement,
     body = document.body || { scrollLeft: 0 };

    return event.pageX || (event.clientX +
      (docElement.scrollLeft || body.scrollLeft) -
      (docElement.clientLeft || 0));
  }

  function pointerY(event) {
    var docElement = document.documentElement,
     body = document.body || { scrollTop: 0 };

    return  event.pageY || (event.clientY +
       (docElement.scrollTop || body.scrollTop) -
       (docElement.clientTop || 0));
  }


  function stop(event) {
    Event.extend(event);
    event.preventDefault();
    event.stopPropagation();

    event.stopped = true;
  }


  Event.Methods = {
    isLeftClick:   isLeftClick,
    isMiddleClick: isMiddleClick,
    isRightClick:  isRightClick,

    element:     element,
    findElement: findElement,

    pointer:  pointer,
    pointerX: pointerX,
    pointerY: pointerY,

    stop: stop
  };

  var methods = Object.keys(Event.Methods).inject({ }, function(m, name) {
    m[name] = Event.Methods[name].methodize();
    return m;
  });

  if (window.attachEvent) {
    function _relatedTarget(event) {
      var element;
      switch (event.type) {
        case 'mouseover':
        case 'mouseenter':
          element = event.fromElement;
          break;
        case 'mouseout':
        case 'mouseleave':
          element = event.toElement;
          break;
        default:
          return null;
      }
      return Element.extend(element);
    }

    var additionalMethods = {
      stopPropagation: function() { this.cancelBubble = true },
      preventDefault:  function() { this.returnValue = false },
      inspect: function() { return '[object Event]' }
    };

    Event.extend = function(event, element) {
      if (!event) return false;

      if (!isIELegacyEvent(event)) return event;

      if (event._extendedByPrototype) return event;
      event._extendedByPrototype = Prototype.emptyFunction;

      var pointer = Event.pointer(event);

      Object.extend(event, {
        target: event.srcElement || element,
        relatedTarget: _relatedTarget(event),
        pageX:  pointer.x,
        pageY:  pointer.y
      });

      Object.extend(event, methods);
      Object.extend(event, additionalMethods);

      return event;
    };
  } else {
    Event.extend = Prototype.K;
  }

  if (window.addEventListener) {
    Event.prototype = window.Event.prototype || document.createEvent('HTMLEvents').__proto__;
    Object.extend(Event.prototype, methods);
  }

  function _createResponder(element, eventName, handler) {
    var registry = Element.retrieve(element, 'prototype_event_registry');

    if (Object.isUndefined(registry)) {
      CACHE.push(element);
      registry = Element.retrieve(element, 'prototype_event_registry', $H());
    }

    var respondersForEvent = registry.get(eventName);
    if (Object.isUndefined(respondersForEvent)) {
      respondersForEvent = [];
      registry.set(eventName, respondersForEvent);
    }

    if (respondersForEvent.pluck('handler').include(handler)) return false;

    var responder;
    if (eventName.include(":")) {
      responder = function(event) {
        if (Object.isUndefined(event.eventName))
          return false;

        if (event.eventName !== eventName)
          return false;

        Event.extend(event, element);
        handler.call(element, event);
      };
    } else {
      if (!MOUSEENTER_MOUSELEAVE_EVENTS_SUPPORTED &&
       (eventName === "mouseenter" || eventName === "mouseleave")) {
        if (eventName === "mouseenter" || eventName === "mouseleave") {
          responder = function(event) {
            Event.extend(event, element);

            var parent = event.relatedTarget;
            while (parent && parent !== element) {
              try { parent = parent.parentNode; }
              catch(e) { parent = element; }
            }

            if (parent === element) return;

            handler.call(element, event);
          };
        }
      } else {
        responder = function(event) {
          Event.extend(event, element);
          handler.call(element, event);
        };
      }
    }

    responder.handler = handler;
    respondersForEvent.push(responder);
    return responder;
  }

  function _destroyCache() {
    for (var i = 0, length = CACHE.length; i < length; i++) {
      Event.stopObserving(CACHE[i]);
      CACHE[i] = null;
    }
  }

  var CACHE = [];

  if (Prototype.Browser.IE)
    window.attachEvent('onunload', _destroyCache);

  if (Prototype.Browser.WebKit)
    window.addEventListener('unload', Prototype.emptyFunction, false);


  var _getDOMEventName = Prototype.K,
      translations = { mouseenter: "mouseover", mouseleave: "mouseout" };

  if (!MOUSEENTER_MOUSELEAVE_EVENTS_SUPPORTED) {
    _getDOMEventName = function(eventName) {
      return (translations[eventName] || eventName);
    };
  }

  function observe(element, eventName, handler) {
    element = $(element);

    var responder = _createResponder(element, eventName, handler);

    if (!responder) return element;

    if (eventName.include(':')) {
      if (element.addEventListener)
        element.addEventListener("dataavailable", responder, false);
      else {
        element.attachEvent("ondataavailable", responder);
        element.attachEvent("onlosecapture", responder);
      }
    } else {
      var actualEventName = _getDOMEventName(eventName);

      if (element.addEventListener)
        element.addEventListener(actualEventName, responder, false);
      else
        element.attachEvent("on" + actualEventName, responder);
    }

    return element;
  }

  function stopObserving(element, eventName, handler) {
    element = $(element);

    var registry = Element.retrieve(element, 'prototype_event_registry');
    if (!registry) return element;

    if (!eventName) {
      registry.each( function(pair) {
        var eventName = pair.key;
        stopObserving(element, eventName);
      });
      return element;
    }

    var responders = registry.get(eventName);
    if (!responders) return element;

    if (!handler) {
      responders.each(function(r) {
        stopObserving(element, eventName, r.handler);
      });
      return element;
    }

    var i = responders.length, responder;
    while (i--) {
      if (responders[i].handler === handler) {
        responder = responders[i];
        break;
      }
    }
    if (!responder) return element;

    if (eventName.include(':')) {
      if (element.removeEventListener)
        element.removeEventListener("dataavailable", responder, false);
      else {
        element.detachEvent("ondataavailable", responder);
        element.detachEvent("onlosecapture", responder);
      }
    } else {
      var actualEventName = _getDOMEventName(eventName);
      if (element.removeEventListener)
        element.removeEventListener(actualEventName, responder, false);
      else
        element.detachEvent('on' + actualEventName, responder);
    }

    registry.set(eventName, responders.without(responder));

    return element;
  }

  function fire(element, eventName, memo, bubble) {
    element = $(element);

    if (Object.isUndefined(bubble))
      bubble = true;

    if (element == document && document.createEvent && !element.dispatchEvent)
      element = document.documentElement;

    var event;
    if (document.createEvent) {
      event = document.createEvent('HTMLEvents');
      event.initEvent('dataavailable', bubble, true);
    } else {
      event = document.createEventObject();
      event.eventType = bubble ? 'ondataavailable' : 'onlosecapture';
    }

    event.eventName = eventName;
    event.memo = memo || { };

    if (document.createEvent)
      element.dispatchEvent(event);
    else
      element.fireEvent(event.eventType, event);

    return Event.extend(event);
  }

  Event.Handler = Class.create({
    initialize: function(element, eventName, selector, callback) {
      this.element   = $(element);
      this.eventName = eventName;
      this.selector  = selector;
      this.callback  = callback;
      this.handler   = this.handleEvent.bind(this);
    },

    start: function() {
      Event.observe(this.element, this.eventName, this.handler);
      return this;
    },

    stop: function() {
      Event.stopObserving(this.element, this.eventName, this.handler);
      return this;
    },

    handleEvent: function(event) {
      var element = Event.findElement(event, this.selector);
      if (element) this.callback.call(this.element, event, element);
    }
  });

  function on(element, eventName, selector, callback) {
    element = $(element);
    if (Object.isFunction(selector) && Object.isUndefined(callback)) {
      callback = selector, selector = null;
    }

    return new Event.Handler(element, eventName, selector, callback).start();
  }

  Object.extend(Event, Event.Methods);

  Object.extend(Event, {
    fire:          fire,
    observe:       observe,
    stopObserving: stopObserving,
    on:            on
  });

  Element.addMethods({
    fire:          fire,

    observe:       observe,

    stopObserving: stopObserving,

    on:            on
  });

  Object.extend(document, {
    fire:          fire.methodize(),

    observe:       observe.methodize(),

    stopObserving: stopObserving.methodize(),

    on:            on.methodize(),

    loaded:        false
  });

  if (window.Event) Object.extend(window.Event, Event);
  else window.Event = Event;
})();

(function() {
  /* Support for the DOMContentLoaded event is based on work by Dan Webb,
     Matthias Miller, Dean Edwards, John Resig, and Diego Perini. */

  var timer;

  function fireContentLoadedEvent() {
    if (document.loaded) return;
    if (timer) window.clearTimeout(timer);
    document.loaded = true;
    document.fire('dom:loaded');
  }

  function checkReadyState() {
    if (document.readyState === 'complete') {
      document.stopObserving('readystatechange', checkReadyState);
      fireContentLoadedEvent();
    }
  }

  function pollDoScroll() {
    try { document.documentElement.doScroll('left'); }
    catch(e) {
      timer = pollDoScroll.defer();
      return;
    }
    fireContentLoadedEvent();
  }

  if (document.addEventListener) {
    document.addEventListener('DOMContentLoaded', fireContentLoadedEvent, false);
  } else {
    document.observe('readystatechange', checkReadyState);
    if (window == top)
      timer = pollDoScroll.defer();
  }

  Event.observe(window, 'load', fireContentLoadedEvent);
})();

Element.addMethods();

/*------------------------------- DEPRECATED -------------------------------*/

Hash.toQueryString = Object.toQueryString;

var Toggle = { display: Element.toggle };

Element.Methods.childOf = Element.Methods.descendantOf;

var Insertion = {
  Before: function(element, content) {
    return Element.insert(element, {before:content});
  },

  Top: function(element, content) {
    return Element.insert(element, {top:content});
  },

  Bottom: function(element, content) {
    return Element.insert(element, {bottom:content});
  },

  After: function(element, content) {
    return Element.insert(element, {after:content});
  }
};

var $continue = new Error('"throw $continue" is deprecated, use "return" instead');

var Position = {
  includeScrollOffsets: false,

  prepare: function() {
    this.deltaX =  window.pageXOffset
                || document.documentElement.scrollLeft
                || document.body.scrollLeft
                || 0;
    this.deltaY =  window.pageYOffset
                || document.documentElement.scrollTop
                || document.body.scrollTop
                || 0;
  },

  within: function(element, x, y) {
    if (this.includeScrollOffsets)
      return this.withinIncludingScrolloffsets(element, x, y);
    this.xcomp = x;
    this.ycomp = y;
    this.offset = Element.cumulativeOffset(element);

    return (y >= this.offset[1] &&
            y <  this.offset[1] + element.offsetHeight &&
            x >= this.offset[0] &&
            x <  this.offset[0] + element.offsetWidth);
  },

  withinIncludingScrolloffsets: function(element, x, y) {
    var offsetcache = Element.cumulativeScrollOffset(element);

    this.xcomp = x + offsetcache[0] - this.deltaX;
    this.ycomp = y + offsetcache[1] - this.deltaY;
    this.offset = Element.cumulativeOffset(element);

    return (this.ycomp >= this.offset[1] &&
            this.ycomp <  this.offset[1] + element.offsetHeight &&
            this.xcomp >= this.offset[0] &&
            this.xcomp <  this.offset[0] + element.offsetWidth);
  },

  overlap: function(mode, element) {
    if (!mode) return 0;
    if (mode == 'vertical')
      return ((this.offset[1] + element.offsetHeight) - this.ycomp) /
        element.offsetHeight;
    if (mode == 'horizontal')
      return ((this.offset[0] + element.offsetWidth) - this.xcomp) /
        element.offsetWidth;
  },


  cumulativeOffset: Element.Methods.cumulativeOffset,

  positionedOffset: Element.Methods.positionedOffset,

  absolutize: function(element) {
    Position.prepare();
    return Element.absolutize(element);
  },

  relativize: function(element) {
    Position.prepare();
    return Element.relativize(element);
  },

  realOffset: Element.Methods.cumulativeScrollOffset,

  offsetParent: Element.Methods.getOffsetParent,

  page: Element.Methods.viewportOffset,

  clone: function(source, target, options) {
    options = options || { };
    return Element.clonePosition(target, source, options);
  }
};

/*--------------------------------------------------------------------------*/

if (!document.getElementsByClassName) document.getElementsByClassName = function(instanceMethods){
  function iter(name) {
    return name.blank() ? null : "[contains(concat(' ', @class, ' '), ' " + name + " ')]";
  }

  instanceMethods.getElementsByClassName = Prototype.BrowserFeatures.XPath ?
  function(element, className) {
    className = className.toString().strip();
    var cond = /\s/.test(className) ? $w(className).map(iter).join('') : iter(className);
    return cond ? document._getElementsByXPath('.//*' + cond, element) : [];
  } : function(element, className) {
    className = className.toString().strip();
    var elements = [], classNames = (/\s/.test(className) ? $w(className) : null);
    if (!classNames && !className) return elements;

    var nodes = $(element).getElementsByTagName('*');
    className = ' ' + className + ' ';

    for (var i = 0, child, cn; child = nodes[i]; i++) {
      if (child.className && (cn = ' ' + child.className + ' ') && (cn.include(className) ||
          (classNames && classNames.all(function(name) {
            return !name.toString().blank() && cn.include(' ' + name + ' ');
          }))))
        elements.push(Element.extend(child));
    }
    return elements;
  };

  return function(className, parentElement) {
    return $(parentElement || document.body).getElementsByClassName(className);
  };
}(Element.Methods);

/*--------------------------------------------------------------------------*/

Element.ClassNames = Class.create();
Element.ClassNames.prototype = {
  initialize: function(element) {
    this.element = $(element);
  },

  _each: function(iterator) {
    this.element.className.split(/\s+/).select(function(name) {
      return name.length > 0;
    })._each(iterator);
  },

  set: function(className) {
    this.element.className = className;
  },

  add: function(classNameToAdd) {
    if (this.include(classNameToAdd)) return;
    this.set($A(this).concat(classNameToAdd).join(' '));
  },

  remove: function(classNameToRemove) {
    if (!this.include(classNameToRemove)) return;
    this.set($A(this).without(classNameToRemove).join(' '));
  },

  toString: function() {
    return $A(this).join(' ');
  }
};

Object.extend(Element.ClassNames.prototype, Enumerable);

/*--------------------------------------------------------------------------*/

(function() {
  window.Selector = Class.create({
    initialize: function(expression) {
      this.expression = expression.strip();
    },

    findElements: function(rootElement) {
      return Prototype.Selector.select(this.expression, rootElement);
    },

    match: function(element) {
      return Prototype.Selector.match(element, this.expression);
    },

    toString: function() {
      return this.expression;
    },

    inspect: function() {
      return "#<Selector: " + this.expression + ">";
    }
  });

  Object.extend(Selector, {
    matchElements: function(elements, expression) {
      var match = Prototype.Selector.match,
          results = [];

      for (var i = 0, length = elements.length; i < length; i++) {
        var element = elements[i];
        if (match(element, expression)) {
          results.push(Element.extend(element));
        }
      }
      return results;
    },

    findElement: function(elements, expression, index) {
      index = index || 0;
      var matchIndex = 0, element;
      for (var i = 0, length = elements.length; i < length; i++) {
        element = elements[i];
        if (Prototype.Selector.match(element, expression) && index === matchIndex++) {
          return Element.extend(element);
        }
      }
    },

    findChildElements: function(element, expressions) {
      var selector = expressions.toArray().join(', ');
      return Prototype.Selector.select(selector, element || document);
    }
  });
})();


// script.aculo.us scriptaculous.js v1.8.1, Thu Jan 03 22:07:12 -0500 2008

// Copyright (c) 2005-2007 Thomas Fuchs (http://script.aculo.us, http://mir.aculo.us)
// 
// Permission is hereby granted, free of charge, to any person obtaining
// a copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so, subject to
// the following conditions:
// 
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
// LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//
// For details, see the script.aculo.us web site: http://script.aculo.us/

var Scriptaculous = {
  Version: '1.8.1',
  require: function(libraryName) {
    // inserting via DOM fails in Safari 2.0, so brute force approach
    document.write('<script type="text/javascript" src="'+libraryName+'"><\/script>');
  },
  REQUIRED_PROTOTYPE: '1.6.0',
  load: function() {
    function convertVersionString(versionString){
      var r = versionString.split('.');
      return parseInt(r[0])*100000 + parseInt(r[1])*1000 + parseInt(r[2]);
    }
 
    if((typeof Prototype=='undefined') || 
       (typeof Element == 'undefined') || 
       (typeof Element.Methods=='undefined') ||
       (convertVersionString(Prototype.Version) < 
        convertVersionString(Scriptaculous.REQUIRED_PROTOTYPE)))
       throw("script.aculo.us requires the Prototype JavaScript framework >= " +
        Scriptaculous.REQUIRED_PROTOTYPE);
    
    $A(document.getElementsByTagName("script")).findAll( function(s) {
      return (s.src && s.src.match(/scriptaculous\.js(\?.*)?$/))
    }).each( function(s) {
      var path = s.src.replace(/scriptaculous\.js(\?.*)?$/,'');
      var includes = s.src.match(/\?.*load=([a-z,]*)/);
      (includes ? includes[1] : 'builder,effects,dragdrop,controls,slider,sound').split(',').each(
       function(include) { Scriptaculous.require(path+include+'.js?sversion=2') });
    });
  }
}

Scriptaculous.load();

// script.aculo.us effects.js v1.8.1, Thu Jan 03 22:07:12 -0500 2008

// Copyright (c) 2005-2007 Thomas Fuchs (http://script.aculo.us, http://mir.aculo.us)
// Contributors:
//  Justin Palmer (http://encytemedia.com/)
//  Mark Pilgrim (http://diveintomark.org/)
//  Martin Bialasinki
// 
// script.aculo.us is freely distributable under the terms of an MIT-style license.
// For details, see the script.aculo.us web site: http://script.aculo.us/ 

// converts rgb() and #xxx to #xxxxxx format,  
// returns self (or first argument) if not convertable  
String.prototype.parseColor = function() {  
  var color = '#';
  if (this.slice(0,4) == 'rgb(') {  
    var cols = this.slice(4,this.length-1).split(',');  
    var i=0; do { color += parseInt(cols[i]).toColorPart() } while (++i<3);  
  } else {  
    if (this.slice(0,1) == '#') {  
      if (this.length==4) for(var i=1;i<4;i++) color += (this.charAt(i) + this.charAt(i)).toLowerCase();  
      if (this.length==7) color = this.toLowerCase();  
    }  
  }  
  return (color.length==7 ? color : (arguments[0] || this));  
};

/*--------------------------------------------------------------------------*/

Element.collectTextNodes = function(element) {  
  return $A($(element).childNodes).collect( function(node) {
    return (node.nodeType==3 ? node.nodeValue : 
      (node.hasChildNodes() ? Element.collectTextNodes(node) : ''));
  }).flatten().join('');
};

Element.collectTextNodesIgnoreClass = function(element, className) {  
  return $A($(element).childNodes).collect( function(node) {
    return (node.nodeType==3 ? node.nodeValue : 
      ((node.hasChildNodes() && !Element.hasClassName(node,className)) ? 
        Element.collectTextNodesIgnoreClass(node, className) : ''));
  }).flatten().join('');
};

Element.setContentZoom = function(element, percent) {
  element = $(element);  
  element.setStyle({fontSize: (percent/100) + 'em'});   
  if (Prototype.Browser.WebKit) window.scrollBy(0,0);
  return element;
};

Element.getInlineOpacity = function(element){
  return $(element).style.opacity || '';
};

Element.forceRerendering = function(element) {
  try {
    element = $(element);
    var n = document.createTextNode(' ');
    element.appendChild(n);
    element.removeChild(n);
  } catch(e) { }
};

/*--------------------------------------------------------------------------*/

var Effect = {
  _elementDoesNotExistError: {
    name: 'ElementDoesNotExistError',
    message: 'The specified DOM element does not exist, but is required for this effect to operate'
  },
  Transitions: {
    linear: Prototype.K,
    sinoidal: function(pos) {
      return (-Math.cos(pos*Math.PI)/2) + 0.5;
    },
    reverse: function(pos) {
      return 1-pos;
    },
    flicker: function(pos) {
      var pos = ((-Math.cos(pos*Math.PI)/4) + 0.75) + Math.random()/4;
      return pos > 1 ? 1 : pos;
    },
    wobble: function(pos) {
      return (-Math.cos(pos*Math.PI*(9*pos))/2) + 0.5;
    },
    pulse: function(pos, pulses) { 
      pulses = pulses || 5; 
      return (
        ((pos % (1/pulses)) * pulses).round() == 0 ? 
              ((pos * pulses * 2) - (pos * pulses * 2).floor()) : 
          1 - ((pos * pulses * 2) - (pos * pulses * 2).floor())
        );
    },
    spring: function(pos) { 
      return 1 - (Math.cos(pos * 4.5 * Math.PI) * Math.exp(-pos * 6)); 
    },
    none: function(pos) {
      return 0;
    },
    full: function(pos) {
      return 1;
    }
  },
  DefaultOptions: {
    duration:   1.0,   // seconds
    fps:        100,   // 100= assume 66fps max.
    sync:       false, // true for combining
    from:       0.0,
    to:         1.0,
    delay:      0.0,
    queue:      'parallel'
  },
  tagifyText: function(element) {
    var tagifyStyle = 'position:relative';
    if (Prototype.Browser.IE) tagifyStyle += ';zoom:1';
    
    element = $(element);
    $A(element.childNodes).each( function(child) {
      if (child.nodeType==3) {
        child.nodeValue.toArray().each( function(character) {
          element.insertBefore(
            new Element('span', {style: tagifyStyle}).update(
              character == ' ' ? String.fromCharCode(160) : character), 
              child);
        });
        Element.remove(child);
      }
    });
  },
  multiple: function(element, effect) {
    var elements;
    if (((typeof element == 'object') || 
        Object.isFunction(element)) && 
       (element.length))
      elements = element;
    else
      elements = $(element).childNodes;
      
    var options = Object.extend({
      speed: 0.1,
      delay: 0.0
    }, arguments[2] || { });
    var masterDelay = options.delay;

    $A(elements).each( function(element, index) {
      new effect(element, Object.extend(options, { delay: index * options.speed + masterDelay }));
    });
  },
  PAIRS: {
    'slide':  ['SlideDown','SlideUp'],
    'blind':  ['BlindDown','BlindUp'],
    'appear': ['Appear','Fade']
  },
  toggle: function(element, effect) {
    element = $(element);
    effect = (effect || 'appear').toLowerCase();
    var options = Object.extend({
      queue: { position:'end', scope:(element.id || 'global'), limit: 1 }
    }, arguments[2] || { });
    Effect[element.visible() ? 
      Effect.PAIRS[effect][1] : Effect.PAIRS[effect][0]](element, options);
  }
};

Effect.DefaultOptions.transition = Effect.Transitions.sinoidal;

/* ------------- core effects ------------- */

Effect.ScopedQueue = Class.create(Enumerable, {
  initialize: function() {
    this.effects  = [];
    this.interval = null;    
  },
  _each: function(iterator) {
    this.effects._each(iterator);
  },
  add: function(effect) {
    var timestamp = new Date().getTime();
    
    var position = Object.isString(effect.options.queue) ? 
      effect.options.queue : effect.options.queue.position;
    
    switch(position) {
      case 'front':
        // move unstarted effects after this effect  
        this.effects.findAll(function(e){ return e.state=='idle' }).each( function(e) {
            e.startOn  += effect.finishOn;
            e.finishOn += effect.finishOn;
          });
        break;
      case 'with-last':
        timestamp = this.effects.pluck('startOn').max() || timestamp;
        break;
      case 'end':
        // start effect after last queued effect has finished
        timestamp = this.effects.pluck('finishOn').max() || timestamp;
        break;
    }
    
    effect.startOn  += timestamp;
    effect.finishOn += timestamp;

    if (!effect.options.queue.limit || (this.effects.length < effect.options.queue.limit))
      this.effects.push(effect);
    
    if (!this.interval)
      this.interval = setInterval(this.loop.bind(this), 15);
  },
  remove: function(effect) {
    this.effects = this.effects.reject(function(e) { return e==effect });
    if (this.effects.length == 0) {
      clearInterval(this.interval);
      this.interval = null;
    }
  },
  loop: function() {
    var timePos = new Date().getTime();
    for(var i=0, len=this.effects.length;i<len;i++) 
      this.effects[i] && this.effects[i].loop(timePos);
  }
});

Effect.Queues = {
  instances: $H(),
  get: function(queueName) {
    if (!Object.isString(queueName)) return queueName;
    
    return this.instances.get(queueName) ||
      this.instances.set(queueName, new Effect.ScopedQueue());
  }
};
Effect.Queue = Effect.Queues.get('global');

Effect.Base = Class.create({
  position: null,
  start: function(options) {
    function codeForEvent(options,eventName){
      return (
        (options[eventName+'Internal'] ? 'this.options.'+eventName+'Internal(this);' : '') +
        (options[eventName] ? 'this.options.'+eventName+'(this);' : '')
      );
    }
    if (options && options.transition === false) options.transition = Effect.Transitions.linear;
    this.options      = Object.extend(Object.extend({ },Effect.DefaultOptions), options || { });
    this.currentFrame = 0;
    this.state        = 'idle';
    this.startOn      = this.options.delay*1000;
    this.finishOn     = this.startOn+(this.options.duration*1000);
    this.fromToDelta  = this.options.to-this.options.from;
    this.totalTime    = this.finishOn-this.startOn;
    this.totalFrames  = this.options.fps*this.options.duration;
    
    eval('this.render = function(pos){ '+
      'if (this.state=="idle"){this.state="running";'+
      codeForEvent(this.options,'beforeSetup')+
      (this.setup ? 'this.setup();':'')+ 
      codeForEvent(this.options,'afterSetup')+
      '};if (this.state=="running"){'+
      'pos=this.options.transition(pos)*'+this.fromToDelta+'+'+this.options.from+';'+
      'this.position=pos;'+
      codeForEvent(this.options,'beforeUpdate')+
      (this.update ? 'this.update(pos);':'')+
      codeForEvent(this.options,'afterUpdate')+
      '}}');
    
    this.event('beforeStart');
    if (!this.options.sync)
      Effect.Queues.get(Object.isString(this.options.queue) ? 
        'global' : this.options.queue.scope).add(this);
  },
  loop: function(timePos) {
    if (timePos >= this.startOn) {
      if (timePos >= this.finishOn) {
        this.render(1.0);
        this.cancel();
        this.event('beforeFinish');
        if (this.finish) this.finish(); 
        this.event('afterFinish');
        return;  
      }
      var pos   = (timePos - this.startOn) / this.totalTime,
          frame = (pos * this.totalFrames).round();
      if (frame > this.currentFrame) {
        this.render(pos);
        this.currentFrame = frame;
      }
    }
  },
  cancel: function() {
    if (!this.options.sync)
      Effect.Queues.get(Object.isString(this.options.queue) ? 
        'global' : this.options.queue.scope).remove(this);
    this.state = 'finished';
  },
  event: function(eventName) {
    if (this.options[eventName + 'Internal']) this.options[eventName + 'Internal'](this);
    if (this.options[eventName]) this.options[eventName](this);
  },
  inspect: function() {
    var data = $H();
    for(property in this)
      if (!Object.isFunction(this[property])) data.set(property, this[property]);
    return '#<Effect:' + data.inspect() + ',options:' + $H(this.options).inspect() + '>';
  }
});

Effect.Parallel = Class.create(Effect.Base, {
  initialize: function(effects) {
    this.effects = effects || [];
    this.start(arguments[1]);
  },
  update: function(position) {
    this.effects.invoke('render', position);
  },
  finish: function(position) {
    this.effects.each( function(effect) {
      effect.render(1.0);
      effect.cancel();
      effect.event('beforeFinish');
      if (effect.finish) effect.finish(position);
      effect.event('afterFinish');
    });
  }
});

Effect.Tween = Class.create(Effect.Base, {
  initialize: function(object, from, to) {
    object = Object.isString(object) ? $(object) : object;
    var args = $A(arguments), method = args.last(), 
      options = args.length == 5 ? args[3] : null;
    this.method = Object.isFunction(method) ? method.bind(object) :
      Object.isFunction(object[method]) ? object[method].bind(object) : 
      function(value) { object[method] = value };
    this.start(Object.extend({ from: from, to: to }, options || { }));
  },
  update: function(position) {
    this.method(position);
  }
});

Effect.Event = Class.create(Effect.Base, {
  initialize: function() {
    this.start(Object.extend({ duration: 0 }, arguments[0] || { }));
  },
  update: Prototype.emptyFunction
});

Effect.Opacity = Class.create(Effect.Base, {
  initialize: function(element) {
    this.element = $(element);
    if (!this.element) throw(Effect._elementDoesNotExistError);
    // make this work on IE on elements without 'layout'
    if (Prototype.Browser.IE && (!this.element.currentStyle.hasLayout))
      this.element.setStyle({zoom: 1});
    var options = Object.extend({
      from: this.element.getOpacity() || 0.0,
      to:   1.0
    }, arguments[1] || { });
    this.start(options);
  },
  update: function(position) {
    this.element.setOpacity(position);
  }
});

Effect.Move = Class.create(Effect.Base, {
  initialize: function(element) {
    this.element = $(element);
    if (!this.element) throw(Effect._elementDoesNotExistError);
    var options = Object.extend({
      x:    0,
      y:    0,
      mode: 'relative'
    }, arguments[1] || { });
    this.start(options);
  },
  setup: function() {
    this.element.makePositioned();
    this.originalLeft = parseFloat(this.element.getStyle('left') || '0');
    this.originalTop  = parseFloat(this.element.getStyle('top')  || '0');
    if (this.options.mode == 'absolute') {
      this.options.x = this.options.x - this.originalLeft;
      this.options.y = this.options.y - this.originalTop;
    }
  },
  update: function(position) {
    this.element.setStyle({
      left: (this.options.x  * position + this.originalLeft).round() + 'px',
      top:  (this.options.y  * position + this.originalTop).round()  + 'px'
    });
  }
});

// for backwards compatibility
Effect.MoveBy = function(element, toTop, toLeft) {
  return new Effect.Move(element, 
    Object.extend({ x: toLeft, y: toTop }, arguments[3] || { }));
};

Effect.Scale = Class.create(Effect.Base, {
  initialize: function(element, percent) {
    this.element = $(element);
    if (!this.element) throw(Effect._elementDoesNotExistError);
    var options = Object.extend({
      scaleX: true,
      scaleY: true,
      scaleContent: true,
      scaleFromCenter: false,
      scaleMode: 'box',        // 'box' or 'contents' or { } with provided values
      scaleFrom: 100.0,
      scaleTo:   percent
    }, arguments[2] || { });
    this.start(options);
  },
  setup: function() {
    this.restoreAfterFinish = this.options.restoreAfterFinish || false;
    this.elementPositioning = this.element.getStyle('position');
    
    this.originalStyle = { };
    ['top','left','width','height','fontSize'].each( function(k) {
      this.originalStyle[k] = this.element.style[k];
    }.bind(this));
      
    this.originalTop  = this.element.offsetTop;
    this.originalLeft = this.element.offsetLeft;
    
    var fontSize = this.element.getStyle('font-size') || '100%';
    ['em','px','%','pt'].each( function(fontSizeType) {
      if (fontSize.indexOf(fontSizeType)>0) {
        this.fontSize     = parseFloat(fontSize);
        this.fontSizeType = fontSizeType;
      }
    }.bind(this));
    
    this.factor = (this.options.scaleTo - this.options.scaleFrom)/100;
    
    this.dims = null;
    if (this.options.scaleMode=='box')
      this.dims = [this.element.offsetHeight, this.element.offsetWidth];
    if (/^content/.test(this.options.scaleMode))
      this.dims = [this.element.scrollHeight, this.element.scrollWidth];
    if (!this.dims)
      this.dims = [this.options.scaleMode.originalHeight,
                   this.options.scaleMode.originalWidth];
  },
  update: function(position) {
    var currentScale = (this.options.scaleFrom/100.0) + (this.factor * position);
    if (this.options.scaleContent && this.fontSize)
      this.element.setStyle({fontSize: this.fontSize * currentScale + this.fontSizeType });
    this.setDimensions(this.dims[0] * currentScale, this.dims[1] * currentScale);
  },
  finish: function(position) {
    if (this.restoreAfterFinish) this.element.setStyle(this.originalStyle);
  },
  setDimensions: function(height, width) {
    var d = { };
    if (this.options.scaleX) d.width = width.round() + 'px';
    if (this.options.scaleY) d.height = height.round() + 'px';
    if (this.options.scaleFromCenter) {
      var topd  = (height - this.dims[0])/2;
      var leftd = (width  - this.dims[1])/2;
      if (this.elementPositioning == 'absolute') {
        if (this.options.scaleY) d.top = this.originalTop-topd + 'px';
        if (this.options.scaleX) d.left = this.originalLeft-leftd + 'px';
      } else {
        if (this.options.scaleY) d.top = -topd + 'px';
        if (this.options.scaleX) d.left = -leftd + 'px';
      }
    }
    this.element.setStyle(d);
  }
});

Effect.Highlight = Class.create(Effect.Base, {
  initialize: function(element) {
    this.element = $(element);
    if (!this.element) throw(Effect._elementDoesNotExistError);
    var options = Object.extend({ startcolor: '#ffff99' }, arguments[1] || { });
    this.start(options);
  },
  setup: function() {
    // Prevent executing on elements not in the layout flow
    if (this.element.getStyle('display')=='none') { this.cancel(); return; }
    // Disable background image during the effect
    this.oldStyle = { };
    if (!this.options.keepBackgroundImage) {
      this.oldStyle.backgroundImage = this.element.getStyle('background-image');
      this.element.setStyle({backgroundImage: 'none'});
    }
    if (!this.options.endcolor)
      this.options.endcolor = this.element.getStyle('background-color').parseColor('#ffffff');
    if (!this.options.restorecolor)
      this.options.restorecolor = this.element.getStyle('background-color');
    // init color calculations
    this._base  = $R(0,2).map(function(i){ return parseInt(this.options.startcolor.slice(i*2+1,i*2+3),16) }.bind(this));
    this._delta = $R(0,2).map(function(i){ return parseInt(this.options.endcolor.slice(i*2+1,i*2+3),16)-this._base[i] }.bind(this));
  },
  update: function(position) {
    this.element.setStyle({backgroundColor: $R(0,2).inject('#',function(m,v,i){
      return m+((this._base[i]+(this._delta[i]*position)).round().toColorPart()); }.bind(this)) });
  },
  finish: function() {
    this.element.setStyle(Object.extend(this.oldStyle, {
      backgroundColor: this.options.restorecolor
    }));
  }
});

Effect.ScrollTo = function(element) {
  var options = arguments[1] || { },
    scrollOffsets = document.viewport.getScrollOffsets(),
    elementOffsets = $(element).cumulativeOffset(),
    max = (window.height || document.body.scrollHeight) - document.viewport.getHeight();  

  if (options.offset) elementOffsets[1] += options.offset;

  return new Effect.Tween(null,
    scrollOffsets.top,
    elementOffsets[1] > max ? max : elementOffsets[1],
    options,
    function(p){ scrollTo(scrollOffsets.left, p.round()) }
  );
};

/* ------------- combination effects ------------- */

Effect.Fade = function(element) {
  element = $(element);
  var oldOpacity = element.getInlineOpacity();
  var options = Object.extend({
    from: element.getOpacity() || 1.0,
    to:   0.0,
    afterFinishInternal: function(effect) { 
      if (effect.options.to!=0) return;
      effect.element.hide().setStyle({opacity: oldOpacity}); 
    }
  }, arguments[1] || { });
  return new Effect.Opacity(element,options);
};

Effect.Appear = function(element) {
  element = $(element);
  var options = Object.extend({
  from: (element.getStyle('display') == 'none' ? 0.0 : element.getOpacity() || 0.0),
  to:   1.0,
  // force Safari to render floated elements properly
  afterFinishInternal: function(effect) {
    effect.element.forceRerendering();
  },
  beforeSetup: function(effect) {
    effect.element.setOpacity(effect.options.from).show(); 
  }}, arguments[1] || { });
  return new Effect.Opacity(element,options);
};

Effect.Puff = function(element) {
  element = $(element);
  var oldStyle = { 
    opacity: element.getInlineOpacity(), 
    position: element.getStyle('position'),
    top:  element.style.top,
    left: element.style.left,
    width: element.style.width,
    height: element.style.height
  };
  return new Effect.Parallel(
   [ new Effect.Scale(element, 200, 
      { sync: true, scaleFromCenter: true, scaleContent: true, restoreAfterFinish: true }), 
     new Effect.Opacity(element, { sync: true, to: 0.0 } ) ], 
     Object.extend({ duration: 1.0, 
      beforeSetupInternal: function(effect) {
        Position.absolutize(effect.effects[0].element)
      },
      afterFinishInternal: function(effect) {
         effect.effects[0].element.hide().setStyle(oldStyle); }
     }, arguments[1] || { })
   );
};

Effect.BlindUp = function(element) {
  element = $(element);
  element.makeClipping();
  return new Effect.Scale(element, 0,
    Object.extend({ scaleContent: false, 
      scaleX: false, 
      restoreAfterFinish: true,
      afterFinishInternal: function(effect) {
        effect.element.hide().undoClipping();
      } 
    }, arguments[1] || { })
  );
};

Effect.BlindDown = function(element) {
  element = $(element);
  var elementDimensions = element.getDimensions();
  return new Effect.Scale(element, 100, Object.extend({ 
    scaleContent: false, 
    scaleX: false,
    scaleFrom: 0,
    scaleMode: {originalHeight: elementDimensions.height, originalWidth: elementDimensions.width},
    restoreAfterFinish: true,
    afterSetup: function(effect) {
      effect.element.makeClipping().setStyle({height: '0px'}).show(); 
    },  
    afterFinishInternal: function(effect) {
      effect.element.undoClipping();
    }
  }, arguments[1] || { }));
};

Effect.SwitchOff = function(element) {
  element = $(element);
  var oldOpacity = element.getInlineOpacity();
  return new Effect.Appear(element, Object.extend({
    duration: 0.4,
    from: 0,
    transition: Effect.Transitions.flicker,
    afterFinishInternal: function(effect) {
      new Effect.Scale(effect.element, 1, { 
        duration: 0.3, scaleFromCenter: true,
        scaleX: false, scaleContent: false, restoreAfterFinish: true,
        beforeSetup: function(effect) { 
          effect.element.makePositioned().makeClipping();
        },
        afterFinishInternal: function(effect) {
          effect.element.hide().undoClipping().undoPositioned().setStyle({opacity: oldOpacity});
        }
      })
    }
  }, arguments[1] || { }));
};

Effect.DropOut = function(element) {
  element = $(element);
  var oldStyle = {
    top: element.getStyle('top'),
    left: element.getStyle('left'),
    opacity: element.getInlineOpacity() };
  return new Effect.Parallel(
    [ new Effect.Move(element, {x: 0, y: 100, sync: true }), 
      new Effect.Opacity(element, { sync: true, to: 0.0 }) ],
    Object.extend(
      { duration: 0.5,
        beforeSetup: function(effect) {
          effect.effects[0].element.makePositioned(); 
        },
        afterFinishInternal: function(effect) {
          effect.effects[0].element.hide().undoPositioned().setStyle(oldStyle);
        } 
      }, arguments[1] || { }));
};

Effect.Shake = function(element) {
  element = $(element);
  var options = Object.extend({
    distance: 20,
    duration: 0.5
  }, arguments[1] || {});
  var distance = parseFloat(options.distance);
  var split = parseFloat(options.duration) / 10.0;
  var oldStyle = {
    top: element.getStyle('top'),
    left: element.getStyle('left') };
    return new Effect.Move(element,
      { x:  distance, y: 0, duration: split, afterFinishInternal: function(effect) {
    new Effect.Move(effect.element,
      { x: -distance*2, y: 0, duration: split*2,  afterFinishInternal: function(effect) {
    new Effect.Move(effect.element,
      { x:  distance*2, y: 0, duration: split*2,  afterFinishInternal: function(effect) {
    new Effect.Move(effect.element,
      { x: -distance*2, y: 0, duration: split*2,  afterFinishInternal: function(effect) {
    new Effect.Move(effect.element,
      { x:  distance*2, y: 0, duration: split*2,  afterFinishInternal: function(effect) {
    new Effect.Move(effect.element,
      { x: -distance, y: 0, duration: split, afterFinishInternal: function(effect) {
        effect.element.undoPositioned().setStyle(oldStyle);
  }}) }}) }}) }}) }}) }});
};

Effect.SlideDown = function(element) {
  element = $(element).cleanWhitespace();
  // SlideDown need to have the content of the element wrapped in a container element with fixed height!
  var oldInnerBottom = element.down().getStyle('bottom');
  var elementDimensions = element.getDimensions();
  return new Effect.Scale(element, 100, Object.extend({ 
    scaleContent: false, 
    scaleX: false, 
    scaleFrom: window.opera ? 0 : 1,
    scaleMode: {originalHeight: elementDimensions.height, originalWidth: elementDimensions.width},
    restoreAfterFinish: true,
    afterSetup: function(effect) {
      effect.element.makePositioned();
      effect.element.down().makePositioned();
      if (window.opera) effect.element.setStyle({top: ''});
      effect.element.makeClipping().setStyle({height: '0px'}).show(); 
    },
    afterUpdateInternal: function(effect) {
      effect.element.down().setStyle({bottom:
        (effect.dims[0] - effect.element.clientHeight) + 'px' }); 
    },
    afterFinishInternal: function(effect) {
      effect.element.undoClipping().undoPositioned();
      effect.element.down().undoPositioned().setStyle({bottom: oldInnerBottom}); }
    }, arguments[1] || { })
  );
};

Effect.SlideUp = function(element) {
  element = $(element).cleanWhitespace();
  var oldInnerBottom = element.down().getStyle('bottom');
  var elementDimensions = element.getDimensions();
  return new Effect.Scale(element, window.opera ? 0 : 1,
   Object.extend({ scaleContent: false, 
    scaleX: false, 
    scaleMode: 'box',
    scaleFrom: 100,
    scaleMode: {originalHeight: elementDimensions.height, originalWidth: elementDimensions.width},
    restoreAfterFinish: true,
    afterSetup: function(effect) {
      effect.element.makePositioned();
      effect.element.down().makePositioned();
      if (window.opera) effect.element.setStyle({top: ''});
      effect.element.makeClipping().show();
    },  
    afterUpdateInternal: function(effect) {
      effect.element.down().setStyle({bottom:
        (effect.dims[0] - effect.element.clientHeight) + 'px' });
    },
    afterFinishInternal: function(effect) {
      effect.element.hide().undoClipping().undoPositioned();
      effect.element.down().undoPositioned().setStyle({bottom: oldInnerBottom});
    }
   }, arguments[1] || { })
  );
};

// Bug in opera makes the TD containing this element expand for a instance after finish 
Effect.Squish = function(element) {
  return new Effect.Scale(element, window.opera ? 1 : 0, { 
    restoreAfterFinish: true,
    beforeSetup: function(effect) {
      effect.element.makeClipping(); 
    },  
    afterFinishInternal: function(effect) {
      effect.element.hide().undoClipping(); 
    }
  });
};

Effect.Grow = function(element) {
  element = $(element);
  var options = Object.extend({
    direction: 'center',
    moveTransition: Effect.Transitions.sinoidal,
    scaleTransition: Effect.Transitions.sinoidal,
    opacityTransition: Effect.Transitions.full
  }, arguments[1] || { });
  var oldStyle = {
    top: element.style.top,
    left: element.style.left,
    height: element.style.height,
    width: element.style.width,
    opacity: element.getInlineOpacity() };

  var dims = element.getDimensions();    
  var initialMoveX, initialMoveY;
  var moveX, moveY;
  
  switch (options.direction) {
    case 'top-left':
      initialMoveX = initialMoveY = moveX = moveY = 0; 
      break;
    case 'top-right':
      initialMoveX = dims.width;
      initialMoveY = moveY = 0;
      moveX = -dims.width;
      break;
    case 'bottom-left':
      initialMoveX = moveX = 0;
      initialMoveY = dims.height;
      moveY = -dims.height;
      break;
    case 'bottom-right':
      initialMoveX = dims.width;
      initialMoveY = dims.height;
      moveX = -dims.width;
      moveY = -dims.height;
      break;
    case 'center':
      initialMoveX = dims.width / 2;
      initialMoveY = dims.height / 2;
      moveX = -dims.width / 2;
      moveY = -dims.height / 2;
      break;
  }
  
  return new Effect.Move(element, {
    x: initialMoveX,
    y: initialMoveY,
    duration: 0.01, 
    beforeSetup: function(effect) {
      effect.element.hide().makeClipping().makePositioned();
    },
    afterFinishInternal: function(effect) {
      new Effect.Parallel(
        [ new Effect.Opacity(effect.element, { sync: true, to: 1.0, from: 0.0, transition: options.opacityTransition }),
          new Effect.Move(effect.element, { x: moveX, y: moveY, sync: true, transition: options.moveTransition }),
          new Effect.Scale(effect.element, 100, {
            scaleMode: { originalHeight: dims.height, originalWidth: dims.width }, 
            sync: true, scaleFrom: window.opera ? 1 : 0, transition: options.scaleTransition, restoreAfterFinish: true})
        ], Object.extend({
             beforeSetup: function(effect) {
               effect.effects[0].element.setStyle({height: '0px'}).show(); 
             },
             afterFinishInternal: function(effect) {
               effect.effects[0].element.undoClipping().undoPositioned().setStyle(oldStyle); 
             }
           }, options)
      )
    }
  });
};

Effect.Shrink = function(element) {
  element = $(element);
  var options = Object.extend({
    direction: 'center',
    moveTransition: Effect.Transitions.sinoidal,
    scaleTransition: Effect.Transitions.sinoidal,
    opacityTransition: Effect.Transitions.none
  }, arguments[1] || { });
  var oldStyle = {
    top: element.style.top,
    left: element.style.left,
    height: element.style.height,
    width: element.style.width,
    opacity: element.getInlineOpacity() };

  var dims = element.getDimensions();
  var moveX, moveY;
  
  switch (options.direction) {
    case 'top-left':
      moveX = moveY = 0;
      break;
    case 'top-right':
      moveX = dims.width;
      moveY = 0;
      break;
    case 'bottom-left':
      moveX = 0;
      moveY = dims.height;
      break;
    case 'bottom-right':
      moveX = dims.width;
      moveY = dims.height;
      break;
    case 'center':  
      moveX = dims.width / 2;
      moveY = dims.height / 2;
      break;
  }
  
  return new Effect.Parallel(
    [ new Effect.Opacity(element, { sync: true, to: 0.0, from: 1.0, transition: options.opacityTransition }),
      new Effect.Scale(element, window.opera ? 1 : 0, { sync: true, transition: options.scaleTransition, restoreAfterFinish: true}),
      new Effect.Move(element, { x: moveX, y: moveY, sync: true, transition: options.moveTransition })
    ], Object.extend({            
         beforeStartInternal: function(effect) {
           effect.effects[0].element.makePositioned().makeClipping(); 
         },
         afterFinishInternal: function(effect) {
           effect.effects[0].element.hide().undoClipping().undoPositioned().setStyle(oldStyle); }
       }, options)
  );
};

Effect.Pulsate = function(element) {
  element = $(element);
  var options    = arguments[1] || { };
  var oldOpacity = element.getInlineOpacity();
  var transition = options.transition || Effect.Transitions.sinoidal;
  var reverser   = function(pos){ return transition(1-Effect.Transitions.pulse(pos, options.pulses)) };
  reverser.bind(transition);
  return new Effect.Opacity(element, 
    Object.extend(Object.extend({  duration: 2.0, from: 0,
      afterFinishInternal: function(effect) { effect.element.setStyle({opacity: oldOpacity}); }
    }, options), {transition: reverser}));
};

Effect.Fold = function(element) {
  element = $(element);
  var oldStyle = {
    top: element.style.top,
    left: element.style.left,
    width: element.style.width,
    height: element.style.height };
  element.makeClipping();
  return new Effect.Scale(element, 5, Object.extend({   
    scaleContent: false,
    scaleX: false,
    afterFinishInternal: function(effect) {
    new Effect.Scale(element, 1, { 
      scaleContent: false, 
      scaleY: false,
      afterFinishInternal: function(effect) {
        effect.element.hide().undoClipping().setStyle(oldStyle);
      } });
  }}, arguments[1] || { }));
};

Effect.Morph = Class.create(Effect.Base, {
  initialize: function(element) {
    this.element = $(element);
    if (!this.element) throw(Effect._elementDoesNotExistError);
    var options = Object.extend({
      style: { }
    }, arguments[1] || { });
    
    if (!Object.isString(options.style)) this.style = $H(options.style);
    else {
      if (options.style.include(':'))
        this.style = options.style.parseStyle();
      else {
        this.element.addClassName(options.style);
        this.style = $H(this.element.getStyles());
        this.element.removeClassName(options.style);
        var css = this.element.getStyles();
        this.style = this.style.reject(function(style) {
          return style.value == css[style.key];
        });
        options.afterFinishInternal = function(effect) {
          effect.element.addClassName(effect.options.style);
          effect.transforms.each(function(transform) {
            effect.element.style[transform.style] = '';
          });
        }
      }
    }
    this.start(options);
  },
  
  setup: function(){
    function parseColor(color){
      if (!color || ['rgba(0, 0, 0, 0)','transparent'].include(color)) color = '#ffffff';
      color = color.parseColor();
      return $R(0,2).map(function(i){
        return parseInt( color.slice(i*2+1,i*2+3), 16 ) 
      });
    }
    this.transforms = this.style.map(function(pair){
      var property = pair[0], value = pair[1], unit = null;

      if (value.parseColor('#zzzzzz') != '#zzzzzz') {
        value = value.parseColor();
        unit  = 'color';
      } else if (property == 'opacity') {
        value = parseFloat(value);
        if (Prototype.Browser.IE && (!this.element.currentStyle.hasLayout))
          this.element.setStyle({zoom: 1});
      } else if (Element.CSS_LENGTH.test(value)) {
          var components = value.match(/^([\+\-]?[0-9\.]+)(.*)$/);
          value = parseFloat(components[1]);
          unit = (components.length == 3) ? components[2] : null;
      }

      var originalValue = this.element.getStyle(property);
      return { 
        style: property.camelize(), 
        originalValue: unit=='color' ? parseColor(originalValue) : parseFloat(originalValue || 0), 
        targetValue: unit=='color' ? parseColor(value) : value,
        unit: unit
      };
    }.bind(this)).reject(function(transform){
      return (
        (transform.originalValue == transform.targetValue) ||
        (
          transform.unit != 'color' &&
          (isNaN(transform.originalValue) || isNaN(transform.targetValue))
        )
      )
    });
  },
  update: function(position) {
    var style = { }, transform, i = this.transforms.length;
    while(i--)
      style[(transform = this.transforms[i]).style] = 
        transform.unit=='color' ? '#'+
          (Math.round(transform.originalValue[0]+
            (transform.targetValue[0]-transform.originalValue[0])*position)).toColorPart() +
          (Math.round(transform.originalValue[1]+
            (transform.targetValue[1]-transform.originalValue[1])*position)).toColorPart() +
          (Math.round(transform.originalValue[2]+
            (transform.targetValue[2]-transform.originalValue[2])*position)).toColorPart() :
        (transform.originalValue +
          (transform.targetValue - transform.originalValue) * position).toFixed(3) + 
            (transform.unit === null ? '' : transform.unit);
    this.element.setStyle(style, true);
  }
});

Effect.Transform = Class.create({
  initialize: function(tracks){
    this.tracks  = [];
    this.options = arguments[1] || { };
    this.addTracks(tracks);
  },
  addTracks: function(tracks){
    tracks.each(function(track){
      track = $H(track);
      var data = track.values().first();
      this.tracks.push($H({
        ids:     track.keys().first(),
        effect:  Effect.Morph,
        options: { style: data }
      }));
    }.bind(this));
    return this;
  },
  play: function(){
    return new Effect.Parallel(
      this.tracks.map(function(track){
        var ids = track.get('ids'), effect = track.get('effect'), options = track.get('options');
        var elements = [$(ids) || $$(ids)].flatten();
        return elements.map(function(e){ return new effect(e, Object.extend({ sync:true }, options)) });
      }).flatten(),
      this.options
    );
  }
});

Element.CSS_PROPERTIES = $w(
  'backgroundColor backgroundPosition borderBottomColor borderBottomStyle ' + 
  'borderBottomWidth borderLeftColor borderLeftStyle borderLeftWidth ' +
  'borderRightColor borderRightStyle borderRightWidth borderSpacing ' +
  'borderTopColor borderTopStyle borderTopWidth bottom clip color ' +
  'fontSize fontWeight height left letterSpacing lineHeight ' +
  'marginBottom marginLeft marginRight marginTop markerOffset maxHeight '+
  'maxWidth minHeight minWidth opacity outlineColor outlineOffset ' +
  'outlineWidth paddingBottom paddingLeft paddingRight paddingTop ' +
  'right textIndent top width wordSpacing zIndex');
  
Element.CSS_LENGTH = /^(([\+\-]?[0-9\.]+)(em|ex|px|in|cm|mm|pt|pc|\%))|0$/;

String.__parseStyleElement = document.createElement('div');
String.prototype.parseStyle = function(){
  var style, styleRules = $H();
  if (Prototype.Browser.WebKit)
    style = new Element('div',{style:this}).style;
  else {
    String.__parseStyleElement.innerHTML = '<div style="' + this + '"></div>';
    style = String.__parseStyleElement.childNodes[0].style;
  }
  
  Element.CSS_PROPERTIES.each(function(property){
    if (style[property]) styleRules.set(property, style[property]); 
  });
  
  if (Prototype.Browser.IE && this.include('opacity'))
    styleRules.set('opacity', this.match(/opacity:\s*((?:0|1)?(?:\.\d*)?)/)[1]);

  return styleRules;
};

if (document.defaultView && document.defaultView.getComputedStyle) {
  Element.getStyles = function(element) {
    var css = document.defaultView.getComputedStyle($(element), null);
    return Element.CSS_PROPERTIES.inject({ }, function(styles, property) {
      styles[property] = css[property];
      return styles;
    });
  };
} else {
  Element.getStyles = function(element) {
    element = $(element);
    var css = element.currentStyle, styles;
    styles = Element.CSS_PROPERTIES.inject({ }, function(results, property) {
      results[property] = css[property];
      return results;
    });
    if (!styles.opacity) styles.opacity = element.getOpacity();
    return styles;
  };
};

Effect.Methods = {
  morph: function(element, style) {
    element = $(element);
    new Effect.Morph(element, Object.extend({ style: style }, arguments[2] || { }));
    return element;
  },
  visualEffect: function(element, effect, options) {
    element = $(element)
    var s = effect.dasherize().camelize(), klass = s.charAt(0).toUpperCase() + s.substring(1);
    new Effect[klass](element, options);
    return element;
  },
  highlight: function(element, options) {
    element = $(element);
    new Effect.Highlight(element, options);
    return element;
  }
};

$w('fade appear grow shrink fold blindUp blindDown slideUp slideDown '+
  'pulsate shake puff squish switchOff dropOut').each(
  function(effect) { 
    Effect.Methods[effect] = function(element, options){
      element = $(element);
      Effect[effect.charAt(0).toUpperCase() + effect.substring(1)](element, options);
      return element;
    }
  }
);

$w('getInlineOpacity forceRerendering setContentZoom collectTextNodes collectTextNodesIgnoreClass getStyles').each( 
  function(f) { Effect.Methods[f] = Element[f]; }
);

Element.addMethods(Effect.Methods);

// script.aculo.us controls.js v1.8.1, Thu Jan 03 22:07:12 -0500 2008

// Copyright (c) 2005-2007 Thomas Fuchs (http://script.aculo.us, http://mir.aculo.us)
//           (c) 2005-2007 Ivan Krstic (http://blogs.law.harvard.edu/ivan)
//           (c) 2005-2007 Jon Tirsen (http://www.tirsen.com)
// Contributors:
//  Richard Livsey
//  Rahul Bhargava
//  Rob Wills
// 
// script.aculo.us is freely distributable under the terms of an MIT-style license.
// For details, see the script.aculo.us web site: http://script.aculo.us/

// Autocompleter.Base handles all the autocompletion functionality 
// that's independent of the data source for autocompletion. This
// includes drawing the autocompletion menu, observing keyboard
// and mouse events, and similar.
//
// Specific autocompleters need to provide, at the very least, 
// a getUpdatedChoices function that will be invoked every time
// the text inside the monitored textbox changes. This method 
// should get the text for which to provide autocompletion by
// invoking this.getToken(), NOT by directly accessing
// this.element.value. This is to allow incremental tokenized
// autocompletion. Specific auto-completion logic (AJAX, etc)
// belongs in getUpdatedChoices.
//
// Tokenized incremental autocompletion is enabled automatically
// when an autocompleter is instantiated with the 'tokens' option
// in the options parameter, e.g.:
// new Ajax.Autocompleter('id','upd', '/url/', { tokens: ',' });
// will incrementally autocomplete with a comma as the token.
// Additionally, ',' in the above example can be replaced with
// a token array, e.g. { tokens: [',', '\n'] } which
// enables autocompletion on multiple tokens. This is most 
// useful when one of the tokens is \n (a newline), as it 
// allows smart autocompletion after linebreaks.

if(typeof Effect == 'undefined')
  throw("controls.js requires including script.aculo.us' effects.js library");

var Autocompleter = { }
Autocompleter.Base = Class.create({
  baseInitialize: function(element, update, options) {
    element          = $(element)
    this.element     = element; 
    this.update      = $(update);  
    this.hasFocus    = false; 
    this.changed     = false; 
    this.active      = false; 
    this.index       = 0;     
    this.entryCount  = 0;
    this.oldElementValue = this.element.value;

    if(this.setOptions)
      this.setOptions(options);
    else
      this.options = options || { };

    var bSetWidth = true;
    if ( typeof( this.options.setWidth ) != 'undefined' )
      bSetWidth = this.options.setWidth;
    
    this.options.paramName    = this.options.paramName || this.element.name;
    this.options.tokens       = this.options.tokens || [];
    this.options.frequency    = this.options.frequency || 0.4;
    this.options.minChars     = this.options.minChars || 1;
    this.options.onShow       = this.options.onShow || 
      function(element, update){ 
        if(!update.style.position || update.style.position=='absolute') {
          update.style.position = 'absolute';
          Position.clone(element, update, {
            setHeight: false, 
            setWidth: bSetWidth,
            offsetTop: element.offsetHeight
          });
        }
        Effect.Appear(update,{duration:0.15});
      };
    this.options.onHide = this.options.onHide || 
      function(element, update){ new Effect.Fade(update,{duration:0.15}) };

    if(typeof(this.options.tokens) == 'string') 
      this.options.tokens = new Array(this.options.tokens);
    // Force carriage returns as token delimiters anyway
    if (!this.options.tokens.include('\n'))
      this.options.tokens.push('\n');

    this.observer = null;
    
    this.element.setAttribute('autocomplete','off');

    Element.hide(this.update);

    Event.observe(this.element, 'blur', this.onBlur.bindAsEventListener(this));
    Event.observe(this.element, 'keydown', this.onKeyPress.bindAsEventListener(this));
  },

  show: function() {
    if(Element.getStyle(this.update, 'display')=='none') this.options.onShow(this.element, this.update);
    if(!this.iefix && 
      (Prototype.Browser.IE) &&
      (Element.getStyle(this.update, 'position')=='absolute')) {
      new Insertion.After(this.update, 
       '<iframe id="' + this.update.id + '_iefix" '+
       'style="display:none;position:absolute;filter:progid:DXImageTransform.Microsoft.Alpha(opacity=0);" ' +
       'src="javascript:false;" frameborder="0" scrolling="no"></iframe>');
      this.iefix = $(this.update.id+'_iefix');
    }
    if(this.iefix) setTimeout(this.fixIEOverlapping.bind(this), 50);
  },
  
  fixIEOverlapping: function() {
    Position.clone(this.update, this.iefix, {setTop:(!this.update.style.height)});
    this.iefix.style.zIndex = 1;
    this.update.style.zIndex = 2;
    Element.show(this.iefix);
  },

  hide: function() {
    this.stopIndicator();
    if(Element.getStyle(this.update, 'display')!='none') this.options.onHide(this.element, this.update);
    if(this.iefix) Element.hide(this.iefix);
  },

  startIndicator: function() {
    if(this.options.indicator) Element.show(this.options.indicator);
  },

  stopIndicator: function() {
    if(this.options.indicator) Element.hide(this.options.indicator);
  },

  onKeyPress: function(event) {
    if(this.active)
      switch(event.keyCode) {
       case Event.KEY_TAB:
       case Event.KEY_RETURN:
         this.selectEntry();
         Event.stop(event);
       case Event.KEY_ESC:
         this.hide();
         this.active = false;
         Event.stop(event);
         return;
       case Event.KEY_LEFT:
       case Event.KEY_RIGHT:
         return;
       case Event.KEY_UP:
         this.markPrevious();
         this.render();
         Event.stop(event);
         return;
       case Event.KEY_DOWN:
         this.markNext();
         this.render();
         Event.stop(event);
         return;
      }
     else 
       if(event.keyCode==Event.KEY_TAB || event.keyCode==Event.KEY_RETURN || 
         (Prototype.Browser.WebKit > 0 && event.keyCode == 0)) return;

    this.changed = true;
    this.hasFocus = true;

    if(this.observer) clearTimeout(this.observer);
      this.observer = 
        setTimeout(this.onObserverEvent.bind(this), this.options.frequency*1000);
  },

  activate: function() {
    this.changed = false;
    this.hasFocus = true;
    this.getUpdatedChoices();
  },

  onHover: function(event) {
    var element = Event.findElement(event, 'LI');
    if(this.index != element.autocompleteIndex) 
    {
        this.index = element.autocompleteIndex;
        this.render();
    }
    Event.stop(event);
  },
  
  onClick: function(event) {
    var element = Event.findElement(event, 'LI');
    this.index = element.autocompleteIndex;
    this.selectEntry();
    this.hide();
  },
  
  onBlur: function(event) {
    // needed to make click events working
    setTimeout(this.hide.bind(this), 250);
    this.hasFocus = false;
    this.active = false;     
  }, 
  
  render: function() {
    if(this.entryCount > 0) {
      for (var i = 0; i < this.entryCount; i++)
        this.index==i ? 
          Element.addClassName(this.getEntry(i),"selected") : 
          Element.removeClassName(this.getEntry(i),"selected");
      if(this.hasFocus) { 
        this.show();
        this.active = true;
      }
    } else {
      this.active = false;
      this.hide();
    }
  },
  
  markPrevious: function() {
    if(this.index > 0) this.index--
      else this.index = this.entryCount-1;
  },
  
  markNext: function() {
    if(this.index < this.entryCount-1) this.index++
      else this.index = 0;
  },
  
  getEntry: function(index) {
    return (index >= 0 && index <= this.entryCount ) ? this.update.firstChild.childNodes[index] : null;
  },
  
  getCurrentEntry: function() {
    return this.getEntry(this.index);
  },
  
  selectEntry: function() {
    this.active = false;
    this.updateElement(this.getCurrentEntry());
  },

  updateElement: function(selectedElement) {
    if (this.options.updateElement) {
      this.options.updateElement(selectedElement);
      return;
    }
    if ( selectedElement )
    {
	    var value = '';
	    if (this.options.select) {
	      var nodes = $(selectedElement).select('.' + this.options.select) || [];
	      if(nodes.length>0) value = Element.collectTextNodes(nodes[0], this.options.select);
	    } else
	      value = Element.collectTextNodesIgnoreClass(selectedElement, 'informal');
	    
	    var bounds = this.getTokenBounds();
	    if (bounds[0] != -1) {
	      var newValue = this.element.value.substr(0, bounds[0]);
	      var whitespace = this.element.value.substr(bounds[0]).match(/^\s+/);
	      if (whitespace)
	        newValue += whitespace[0];
	      this.element.value = newValue + value + this.element.value.substr(bounds[1]);
	    } else {
	      this.element.value = value;
	    }
	    this.oldElementValue = this.element.value;
	    this.element.focus();
    }
    
    if (this.options.afterUpdateElement)
      this.options.afterUpdateElement(this.element, selectedElement);
  },

  updateChoices: function(choices) {
    if(!this.changed && this.hasFocus) {
      this.update.innerHTML = choices;
      Element.cleanWhitespace(this.update);
      Element.cleanWhitespace(this.update.down());

      if(this.update.firstChild && this.update.down().childNodes) {
        this.entryCount = 
          this.update.down().childNodes.length;
        for (var i = 0; i < this.entryCount; i++) {
          var entry = this.getEntry(i);
          entry.autocompleteIndex = i;
          this.addObservers(entry);
        }
      } else { 
        this.entryCount = 0;
      }

      this.stopIndicator();
      this.index = ( this.options.allowFreeEntry ? -1 : 0 );
      
      if(this.entryCount==1 && this.options.autoSelect) {
        this.selectEntry();
        this.hide();
      } else {
        this.render();
      }
    }
  },

  addObservers: function(element) {
    Event.observe(element, "mouseover", this.onHover.bindAsEventListener(this));
    Event.observe(element, "click", this.onClick.bindAsEventListener(this));
  },

  onObserverEvent: function() {
    this.changed = false;   
    this.tokenBounds = null;
    if(this.getToken().length>=this.options.minChars) {
      this.getUpdatedChoices();
    } else {
      this.active = false;
      this.hide();
    }
    this.oldElementValue = this.element.value;
  },

  getToken: function() {
    var bounds = this.getTokenBounds();
    return this.element.value.substring(bounds[0], bounds[1]).strip();
  },

  getTokenBounds: function() {
    if (null != this.tokenBounds) return this.tokenBounds;
    var value = this.element.value;
    if (value.strip().empty()) return [-1, 0];
    var diff = arguments.callee.getFirstDifferencePos(value, this.oldElementValue);
    var offset = (diff == this.oldElementValue.length ? 1 : 0);
    var prevTokenPos = -1, nextTokenPos = value.length;
    var tp;
    for (var index = 0, l = this.options.tokens.length; index < l; ++index) {
      tp = value.lastIndexOf(this.options.tokens[index], diff + offset - 1);
      if (tp > prevTokenPos) prevTokenPos = tp;
      tp = value.indexOf(this.options.tokens[index], diff + offset);
      if (-1 != tp && tp < nextTokenPos) nextTokenPos = tp;
    }
    return (this.tokenBounds = [prevTokenPos + 1, nextTokenPos]);
  }
});

Autocompleter.Base.prototype.getTokenBounds.getFirstDifferencePos = function(newS, oldS) {
  var boundary = Math.min(newS.length, oldS.length);
  for (var index = 0; index < boundary; ++index)
    if (newS[index] != oldS[index])
      return index;
  return boundary;
};

Ajax.Autocompleter = Class.create(Autocompleter.Base, {
  initialize: function(element, update, url, options) {
    this.baseInitialize(element, update, options);
    this.options.asynchronous  = true;
    this.options.onComplete    = this.onComplete.bind(this);
    this.options.defaultParams = this.options.parameters || null;
    this.url                   = url;
  },

  getUpdatedChoices: function() {
    this.startIndicator();
    
    var entry = encodeURIComponent(this.options.paramName) + '=' + 
      encodeURIComponent(this.getToken());

    this.options.parameters = this.options.callback ?
      this.options.callback(this.element, entry) : entry;

    if(this.options.defaultParams) 
      this.options.parameters += '&' + this.options.defaultParams;
    
    new Ajax.Request(this.url, this.options);
  },

  onComplete: function(request) {
    this.updateChoices(request.responseText);
  }
});

// The local array autocompleter. Used when you'd prefer to
// inject an array of autocompletion options into the page, rather
// than sending out Ajax queries, which can be quite slow sometimes.
//
// The constructor takes four parameters. The first two are, as usual,
// the id of the monitored textbox, and id of the autocompletion menu.
// The third is the array you want to autocomplete from, and the fourth
// is the options block.
//
// Extra local autocompletion options:
// - choices - How many autocompletion choices to offer
//
// - partialSearch - If false, the autocompleter will match entered
//                    text only at the beginning of strings in the 
//                    autocomplete array. Defaults to true, which will
//                    match text at the beginning of any *word* in the
//                    strings in the autocomplete array. If you want to
//                    search anywhere in the string, additionally set
//                    the option fullSearch to true (default: off).
//
// - fullSsearch - Search anywhere in autocomplete array strings.
//
// - partialChars - How many characters to enter before triggering
//                   a partial match (unlike minChars, which defines
//                   how many characters are required to do any match
//                   at all). Defaults to 2.
//
// - ignoreCase - Whether to ignore case when autocompleting.
//                 Defaults to true.
//
// It's possible to pass in a custom function as the 'selector' 
// option, if you prefer to write your own autocompletion logic.
// In that case, the other options above will not apply unless
// you support them.

Autocompleter.Local = Class.create(Autocompleter.Base, {
  initialize: function(element, update, array, options) {
    this.baseInitialize(element, update, options);
    this.options.array = array;
  },

  getUpdatedChoices: function() {
    this.updateChoices(this.options.selector(this));
  },

  setOptions: function(options) {
    this.options = Object.extend({
      choices: 10,
      partialSearch: true,
      partialChars: 2,
      ignoreCase: true,
      fullSearch: false,
      selector: function(instance) {
        var ret       = []; // Beginning matches
        var partial   = []; // Inside matches
        var entry     = instance.getToken();
        var count     = 0;

        for (var i = 0; i < instance.options.array.length &&  
          ret.length < instance.options.choices ; i++) { 

          var elem = instance.options.array[i];
          var foundPos = instance.options.ignoreCase ? 
            elem.toLowerCase().indexOf(entry.toLowerCase()) : 
            elem.indexOf(entry);

          while (foundPos != -1) {
            if (foundPos == 0 && elem.length != entry.length) { 
              ret.push("<li><strong>" + elem.substr(0, entry.length) + "</strong>" + 
                elem.substr(entry.length) + "</li>");
              break;
            } else if (entry.length >= instance.options.partialChars && 
              instance.options.partialSearch && foundPos != -1) {
              if (instance.options.fullSearch || /\s/.test(elem.substr(foundPos-1,1))) {
                partial.push("<li>" + elem.substr(0, foundPos) + "<strong>" +
                  elem.substr(foundPos, entry.length) + "</strong>" + elem.substr(
                  foundPos + entry.length) + "</li>");
                break;
              }
            }

            foundPos = instance.options.ignoreCase ? 
              elem.toLowerCase().indexOf(entry.toLowerCase(), foundPos + 1) : 
              elem.indexOf(entry, foundPos + 1);

          }
        }
        if (partial.length)
          ret = ret.concat(partial.slice(0, instance.options.choices - ret.length))
        return "<ul>" + ret.join('') + "</ul>";
      }
    }, options || { });
  }
});

// AJAX in-place editor and collection editor
// Full rewrite by Christophe Porteneuve <tdd@tddsworld.com> (April 2007).

// Use this if you notice weird scrolling problems on some browsers,
// the DOM might be a bit confused when this gets called so do this
// waits 1 ms (with setTimeout) until it does the activation
Field.scrollFreeActivate = function(field) {
  setTimeout(function() {
    Field.activate(field);
  }, 1);
}

Ajax.InPlaceEditor = Class.create({
  initialize: function(element, url, options) {
    this.url = url;
    this.element = element = $(element);
    this.prepareOptions();
    this._controls = { };
    arguments.callee.dealWithDeprecatedOptions(options); // DEPRECATION LAYER!!!
    Object.extend(this.options, options || { });
    if (!this.options.formId && this.element.id) {
      this.options.formId = this.element.id + '-inplaceeditor';
      if ($(this.options.formId))
        this.options.formId = '';
    }
    if (this.options.externalControl)
      this.options.externalControl = $(this.options.externalControl);
    if (!this.options.externalControl)
      this.options.externalControlOnly = false;
    this._originalBackground = this.element.getStyle('background-color') || 'transparent';
    this.element.title = this.options.clickToEditText;
    this._boundCancelHandler = this.handleFormCancellation.bind(this);
    this._boundComplete = (this.options.onComplete || Prototype.emptyFunction).bind(this);
    this._boundFailureHandler = this.handleAJAXFailure.bind(this);
    this._boundSubmitHandler = this.handleFormSubmission.bind(this);
    this._boundWrapperHandler = this.wrapUp.bind(this);
    this.registerListeners();
  },
  checkForEscapeOrReturn: function(e) {
    if (!this._editing || e.ctrlKey || e.altKey || e.shiftKey) return;
    if (Event.KEY_ESC == e.keyCode)
      this.handleFormCancellation(e);
    else if (Event.KEY_RETURN == e.keyCode)
      this.handleFormSubmission(e);
  },
  createControl: function(mode, handler, extraClasses) {
    var control = this.options[mode + 'Control'];
    var text = this.options[mode + 'Text'];
    if ('button' == control) {
      var btn = document.createElement('input');
      btn.type = 'submit';
      btn.value = text;
      btn.className = 'editor_' + mode + '_button';
      if ('cancel' == mode)
        btn.onclick = this._boundCancelHandler;
      this._form.appendChild(btn);
      this._controls[mode] = btn;
    } else if ('link' == control) {
      var link = document.createElement('a');
      link.href = '#';
      link.appendChild(document.createTextNode(text));
      link.onclick = 'cancel' == mode ? this._boundCancelHandler : this._boundSubmitHandler;
      link.className = 'editor_' + mode + '_link';
      if (extraClasses)
        link.className += ' ' + extraClasses;
      this._form.appendChild(link);
      this._controls[mode] = link;
    }
  },
  createEditField: function() {
    var text = (this.options.loadTextURL ? this.options.loadingText : this.getText());
    var fld;
    if (1 >= this.options.rows && !/\r|\n/.test(this.getText())) {
      fld = document.createElement('input');
      fld.type = 'text';
      var size = this.options.size || this.options.cols || 0;
      if (0 < size) fld.size = size;
    } else {
      fld = document.createElement('textarea');
      fld.rows = (1 >= this.options.rows ? this.options.autoRows : this.options.rows);
      fld.cols = this.options.cols || 40;
    }
    fld.name = this.options.paramName;
    fld.value = text; // No HTML breaks conversion anymore
    fld.className = 'editor_field';
    if (this.options.submitOnBlur)
      fld.onblur = this._boundSubmitHandler;
    this._controls.editor = fld;
    if (this.options.loadTextURL)
      this.loadExternalText();
    this._form.appendChild(this._controls.editor);
  },
  createForm: function() {
    var ipe = this;
    function addText(mode, condition) {
      var text = ipe.options['text' + mode + 'Controls'];
      if (!text || condition === false) return;
      ipe._form.appendChild(document.createTextNode(text));
    };
    this._form = $(document.createElement('form'));
    this._form.id = this.options.formId;
    this._form.addClassName(this.options.formClassName);
    this._form.onsubmit = this._boundSubmitHandler;
    this.createEditField();
    if ('textarea' == this._controls.editor.tagName.toLowerCase())
      this._form.appendChild(document.createElement('br'));
    if (this.options.onFormCustomization)
      this.options.onFormCustomization(this, this._form);
    addText('Before', this.options.okControl || this.options.cancelControl);
    this.createControl('ok', this._boundSubmitHandler);
    addText('Between', this.options.okControl && this.options.cancelControl);
    this.createControl('cancel', this._boundCancelHandler, 'editor_cancel');
    addText('After', this.options.okControl || this.options.cancelControl);
  },
  destroy: function() {
    if (this._oldInnerHTML)
      this.element.innerHTML = this._oldInnerHTML;
    this.leaveEditMode();
    this.unregisterListeners();
  },
  enterEditMode: function(e) {
    if (this._saving || this._editing) return;
    this._editing = true;
    this.triggerCallback('onEnterEditMode');
    if (this.options.externalControl)
      this.options.externalControl.hide();
    this.element.hide();
    this.createForm();
    this.element.parentNode.insertBefore(this._form, this.element);
    if (!this.options.loadTextURL)
      this.postProcessEditField();
    if (e) Event.stop(e);
  },
  enterHover: function(e) {
    if (this.options.hoverClassName)
      this.element.addClassName(this.options.hoverClassName);
    if (this._saving) return;
    this.triggerCallback('onEnterHover');
  },
  getText: function() {
    return this.element.innerHTML;
  },
  handleAJAXFailure: function(transport) {
    this.triggerCallback('onFailure', transport);
    if (this._oldInnerHTML) {
      this.element.innerHTML = this._oldInnerHTML;
      this._oldInnerHTML = null;
    }
  },
  handleFormCancellation: function(e) {
    this.wrapUp();
    if (e) Event.stop(e);
  },
  handleFormSubmission: function(e) {
    var form = this._form;
    var value = $F(this._controls.editor);
    this.prepareSubmission();
    var params = this.options.callback(form, value) || '';
    if (Object.isString(params))
      params = params.toQueryParams();
    params.editorId = this.element.id;
    if (this.options.htmlResponse) {
      var options = Object.extend({ evalScripts: true }, this.options.ajaxOptions);
      Object.extend(options, {
        parameters: params,
        onComplete: this._boundWrapperHandler,
        onFailure: this._boundFailureHandler
      });
      new Ajax.Updater({ success: this.element }, this.url, options);
    } else {
      var options = Object.extend({ method: 'get' }, this.options.ajaxOptions);
      Object.extend(options, {
        parameters: params,
        onComplete: this._boundWrapperHandler,
        onFailure: this._boundFailureHandler
      });
      new Ajax.Request(this.url, options);
    }
    if (e) Event.stop(e);
  },
  leaveEditMode: function() {
    this.element.removeClassName(this.options.savingClassName);
    this.removeForm();
    this.leaveHover();
    this.element.style.backgroundColor = this._originalBackground;
    this.element.show();
    if (this.options.externalControl)
      this.options.externalControl.show();
    this._saving = false;
    this._editing = false;
    this._oldInnerHTML = null;
    this.triggerCallback('onLeaveEditMode');
  },
  leaveHover: function(e) {
    if (this.options.hoverClassName)
      this.element.removeClassName(this.options.hoverClassName);
    if (this._saving) return;
    this.triggerCallback('onLeaveHover');
  },
  loadExternalText: function() {
    this._form.addClassName(this.options.loadingClassName);
    this._controls.editor.disabled = true;
    var options = Object.extend({ method: 'get' }, this.options.ajaxOptions);
    Object.extend(options, {
      parameters: 'editorId=' + encodeURIComponent(this.element.id),
      onComplete: Prototype.emptyFunction,
      onSuccess: function(transport) {
        this._form.removeClassName(this.options.loadingClassName);
        var text = transport.responseText;
        if (this.options.stripLoadedTextTags)
          text = text.stripTags();
        this._controls.editor.value = text;
        this._controls.editor.disabled = false;
        this.postProcessEditField();
      }.bind(this),
      onFailure: this._boundFailureHandler
    });
    new Ajax.Request(this.options.loadTextURL, options);
  },
  postProcessEditField: function() {
    var fpc = this.options.fieldPostCreation;
    if (fpc)
      $(this._controls.editor)['focus' == fpc ? 'focus' : 'activate']();
  },
  prepareOptions: function() {
    this.options = Object.clone(Ajax.InPlaceEditor.DefaultOptions);
    Object.extend(this.options, Ajax.InPlaceEditor.DefaultCallbacks);
    [this._extraDefaultOptions].flatten().compact().each(function(defs) {
      Object.extend(this.options, defs);
    }.bind(this));
  },
  prepareSubmission: function() {
    this._saving = true;
    this.removeForm();
    this.leaveHover();
    this.showSaving();
  },
  registerListeners: function() {
    this._listeners = { };
    var listener;
    $H(Ajax.InPlaceEditor.Listeners).each(function(pair) {
      listener = this[pair.value].bind(this);
      this._listeners[pair.key] = listener;
      if (!this.options.externalControlOnly)
        this.element.observe(pair.key, listener);
      if (this.options.externalControl)
        this.options.externalControl.observe(pair.key, listener);
    }.bind(this));
  },
  removeForm: function() {
    if (!this._form) return;
    this._form.remove();
    this._form = null;
    this._controls = { };
  },
  showSaving: function() {
    this._oldInnerHTML = this.element.innerHTML;
    this.element.innerHTML = this.options.savingText;
    this.element.addClassName(this.options.savingClassName);
    this.element.style.backgroundColor = this._originalBackground;
    this.element.show();
  },
  triggerCallback: function(cbName, arg) {
    if ('function' == typeof this.options[cbName]) {
      this.options[cbName](this, arg);
    }
  },
  unregisterListeners: function() {
    $H(this._listeners).each(function(pair) {
      if (!this.options.externalControlOnly)
        this.element.stopObserving(pair.key, pair.value);
      if (this.options.externalControl)
        this.options.externalControl.stopObserving(pair.key, pair.value);
    }.bind(this));
  },
  wrapUp: function(transport) {
    this.leaveEditMode();
    // Can't use triggerCallback due to backward compatibility: requires
    // binding + direct element
    this._boundComplete(transport, this.element);
  }
});

Object.extend(Ajax.InPlaceEditor.prototype, {
  dispose: Ajax.InPlaceEditor.prototype.destroy
});

Ajax.InPlaceCollectionEditor = Class.create(Ajax.InPlaceEditor, {
  initialize: function($super, element, url, options) {
    this._extraDefaultOptions = Ajax.InPlaceCollectionEditor.DefaultOptions;
    $super(element, url, options);
  },

  createEditField: function() {
    var list = document.createElement('select');
    list.name = this.options.paramName;
    list.size = 1;
    this._controls.editor = list;
    this._collection = this.options.collection || [];
    if (this.options.loadCollectionURL)
      this.loadCollection();
    else
      this.checkForExternalText();
    this._form.appendChild(this._controls.editor);
  },

  loadCollection: function() {
    this._form.addClassName(this.options.loadingClassName);
    this.showLoadingText(this.options.loadingCollectionText);
    var options = Object.extend({ method: 'get' }, this.options.ajaxOptions);
    Object.extend(options, {
      parameters: 'editorId=' + encodeURIComponent(this.element.id),
      onComplete: Prototype.emptyFunction,
      onSuccess: function(transport) {
        var js = transport.responseText.strip();
        if (!/^\[.*\]$/.test(js)) // TODO: improve sanity check
          throw 'Server returned an invalid collection representation.';
        this._collection = eval(js);
        this.checkForExternalText();
      }.bind(this),
      onFailure: this.onFailure
    });
    new Ajax.Request(this.options.loadCollectionURL, options);
  },

  showLoadingText: function(text) {
    this._controls.editor.disabled = true;
    var tempOption = this._controls.editor.firstChild;
    if (!tempOption) {
      tempOption = document.createElement('option');
      tempOption.value = '';
      this._controls.editor.appendChild(tempOption);
      tempOption.selected = true;
    }
    tempOption.update((text || '').stripScripts().stripTags());
  },

  checkForExternalText: function() {
    this._text = this.getText();
    if (this.options.loadTextURL)
      this.loadExternalText();
    else
      this.buildOptionList();
  },

  loadExternalText: function() {
    this.showLoadingText(this.options.loadingText);
    var options = Object.extend({ method: 'get' }, this.options.ajaxOptions);
    Object.extend(options, {
      parameters: 'editorId=' + encodeURIComponent(this.element.id),
      onComplete: Prototype.emptyFunction,
      onSuccess: function(transport) {
        this._text = transport.responseText.strip();
        this.buildOptionList();
      }.bind(this),
      onFailure: this.onFailure
    });
    new Ajax.Request(this.options.loadTextURL, options);
  },

  buildOptionList: function() {
    this._form.removeClassName(this.options.loadingClassName);
    this._collection = this._collection.map(function(entry) {
      return 2 === entry.length ? entry : [entry, entry].flatten();
    });
    var marker = ('value' in this.options) ? this.options.value : this._text;
    var textFound = this._collection.any(function(entry) {
      return entry[0] == marker;
    }.bind(this));
    this._controls.editor.update('');
    var option;
    this._collection.each(function(entry, index) {
      option = document.createElement('option');
      option.value = entry[0];
      option.selected = textFound ? entry[0] == marker : 0 == index;
      option.appendChild(document.createTextNode(entry[1]));
      this._controls.editor.appendChild(option);
    }.bind(this));
    this._controls.editor.disabled = false;
    Field.scrollFreeActivate(this._controls.editor);
  }
});

//**** DEPRECATION LAYER FOR InPlace[Collection]Editor! ****
//**** This only  exists for a while,  in order to  let ****
//**** users adapt to  the new API.  Read up on the new ****
//**** API and convert your code to it ASAP!            ****

Ajax.InPlaceEditor.prototype.initialize.dealWithDeprecatedOptions = function(options) {
  if (!options) return;
  function fallback(name, expr) {
    if (name in options || expr === undefined) return;
    options[name] = expr;
  };
  fallback('cancelControl', (options.cancelLink ? 'link' : (options.cancelButton ? 'button' :
    options.cancelLink == options.cancelButton == false ? false : undefined)));
  fallback('okControl', (options.okLink ? 'link' : (options.okButton ? 'button' :
    options.okLink == options.okButton == false ? false : undefined)));
  fallback('highlightColor', options.highlightcolor);
  fallback('highlightEndColor', options.highlightendcolor);
};

Object.extend(Ajax.InPlaceEditor, {
  DefaultOptions: {
    ajaxOptions: { },
    autoRows: 3,                                // Use when multi-line w/ rows == 1
    cancelControl: 'link',                      // 'link'|'button'|false
    cancelText: 'cancel',
    clickToEditText: 'Click to edit',
    externalControl: null,                      // id|elt
    externalControlOnly: false,
    fieldPostCreation: 'activate',              // 'activate'|'focus'|false
    formClassName: 'inplaceeditor-form',
    formId: null,                               // id|elt
    highlightColor: '#ffff99',
    highlightEndColor: '#ffffff',
    hoverClassName: '',
    htmlResponse: true,
    loadingClassName: 'inplaceeditor-loading',
    loadingText: 'Loading...',
    okControl: 'button',                        // 'link'|'button'|false
    okText: 'ok',
    paramName: 'value',
    rows: 1,                                    // If 1 and multi-line, uses autoRows
    savingClassName: 'inplaceeditor-saving',
    savingText: 'Saving...',
    size: 0,
    stripLoadedTextTags: false,
    submitOnBlur: false,
    textAfterControls: '',
    textBeforeControls: '',
    textBetweenControls: ''
  },
  DefaultCallbacks: {
    callback: function(form) {
      return Form.serialize(form);
    },
    onComplete: function(transport, element) {
      // For backward compatibility, this one is bound to the IPE, and passes
      // the element directly.  It was too often customized, so we don't break it.
      new Effect.Highlight(element, {
        startcolor: this.options.highlightColor, keepBackgroundImage: true });
    },
    onEnterEditMode: null,
    onEnterHover: function(ipe) {
      ipe.element.style.backgroundColor = ipe.options.highlightColor;
      if (ipe._effect)
        ipe._effect.cancel();
    },
    onFailure: function(transport, ipe) {
      alert('Error communication with the server: ' + transport.responseText.stripTags());
    },
    onFormCustomization: null, // Takes the IPE and its generated form, after editor, before controls.
    onLeaveEditMode: null,
    onLeaveHover: function(ipe) {
      ipe._effect = new Effect.Highlight(ipe.element, {
        startcolor: ipe.options.highlightColor, endcolor: ipe.options.highlightEndColor,
        restorecolor: ipe._originalBackground, keepBackgroundImage: true
      });
    }
  },
  Listeners: {
    click: 'enterEditMode',
    keydown: 'checkForEscapeOrReturn',
    mouseover: 'enterHover',
    mouseout: 'leaveHover'
  }
});

Ajax.InPlaceCollectionEditor.DefaultOptions = {
  loadingCollectionText: 'Loading options...'
};

// Delayed observer, like Form.Element.Observer, 
// but waits for delay after last key input
// Ideal for live-search fields

Form.Element.DelayedObserver = Class.create({
  initialize: function(element, delay, callback) {
    this.delay     = delay || 0.5;
    this.element   = $(element);
    this.callback  = callback;
    this.timer     = null;
    this.lastValue = $F(this.element); 
    Event.observe(this.element,'keyup',this.delayedListener.bindAsEventListener(this));
  },
  delayedListener: function(event) {
    if(this.lastValue == $F(this.element)) return;
    if(this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(this.onTimerEvent.bind(this), this.delay * 1000);
    this.lastValue = $F(this.element);
  },
  onTimerEvent: function() {
    this.timer = null;
    this.callback(this.element, $F(this.element));
  }
});

// script.aculo.us slider.js v1.8.1, Thu Jan 03 22:07:12 -0500 2008

// Copyright (c) 2005-2007 Marty Haught, Thomas Fuchs 
//
// script.aculo.us is freely distributable under the terms of an MIT-style license.
// For details, see the script.aculo.us web site: http://script.aculo.us/

if (!Control) var Control = { };

// options:
//  axis: 'vertical', or 'horizontal' (default)
//
// callbacks:
//  onChange(value)
//  onSlide(value)
Control.Slider = Class.create({
  initialize: function(handle, track, options) {
    var slider = this;
    
    if (Object.isArray(handle)) {
      this.handles = handle.collect( function(e) { return $(e) });
    } else {
      this.handles = [$(handle)];
    }
    
    this.track   = $(track);
    this.options = options || { };

    this.axis      = this.options.axis || 'horizontal';
    this.increment = this.options.increment || 1;
    this.step      = parseInt(this.options.step || '1');
    this.range     = this.options.range || $R(0,1);
    
    this.value     = 0; // assure backwards compat
    this.values    = this.handles.map( function() { return 0 });
    this.spans     = this.options.spans ? this.options.spans.map(function(s){ return $(s) }) : false;
    this.options.startSpan = $(this.options.startSpan || null);
    this.options.endSpan   = $(this.options.endSpan || null);

    this.restricted = this.options.restricted || false;

    this.maximum   = this.options.maximum || this.range.end;
    this.minimum   = this.options.minimum || this.range.start;

    // Will be used to align the handle onto the track, if necessary
    this.alignX = parseInt(this.options.alignX || '0');
    this.alignY = parseInt(this.options.alignY || '0');
    
    this.trackLength = this.maximumOffset() - this.minimumOffset();

    this.handleLength = this.isVertical() ? 
      (this.handles[0].offsetHeight != 0 ? 
        this.handles[0].offsetHeight : this.handles[0].style.height.replace(/px$/,"")) : 
      (this.handles[0].offsetWidth != 0 ? this.handles[0].offsetWidth : 
        this.handles[0].style.width.replace(/px$/,""));

    this.active   = false;
    this.dragging = false;
    this.disabled = false;

    if (this.options.disabled) this.setDisabled();

    // Allowed values array
    this.allowedValues = this.options.values ? this.options.values.sortBy(Prototype.K) : false;
    if (this.allowedValues) {
      this.minimum = this.allowedValues.min();
      this.maximum = this.allowedValues.max();
    }

    this.eventMouseDown = this.startDrag.bindAsEventListener(this);
    this.eventMouseUp   = this.endDrag.bindAsEventListener(this);
    this.eventMouseMove = this.update.bindAsEventListener(this);

    // Initialize handles in reverse (make sure first handle is active)
    this.handles.each( function(h,i) {
      i = slider.handles.length-1-i;
      slider.setValue(parseFloat(
        (Object.isArray(slider.options.sliderValue) ? 
          slider.options.sliderValue[i] : slider.options.sliderValue) || 
         slider.range.start), i);
      h.makePositioned().observe("mousedown", slider.eventMouseDown);
    });
    
    this.track.observe("mousedown", this.eventMouseDown);
    document.observe("mouseup", this.eventMouseUp);
    document.observe("mousemove", this.eventMouseMove);
    
    this.initialized = true;
  },
  dispose: function() {
    var slider = this;    
    Event.stopObserving(this.track, "mousedown", this.eventMouseDown);
    Event.stopObserving(document, "mouseup", this.eventMouseUp);
    Event.stopObserving(document, "mousemove", this.eventMouseMove);
    this.handles.each( function(h) {
      Event.stopObserving(h, "mousedown", slider.eventMouseDown);
    });
  },
  setDisabled: function(){
    this.disabled = true;
  },
  setEnabled: function(){
    this.disabled = false;
  },  
  getNearestValue: function(value){
    if (this.allowedValues){
      if (value >= this.allowedValues.max()) return(this.allowedValues.max());
      if (value <= this.allowedValues.min()) return(this.allowedValues.min());
      
      var offset = Math.abs(this.allowedValues[0] - value);
      var newValue = this.allowedValues[0];
      this.allowedValues.each( function(v) {
        var currentOffset = Math.abs(v - value);
        if (currentOffset <= offset){
          newValue = v;
          offset = currentOffset;
        } 
      });
      return newValue;
    }
    if (value > this.range.end) return this.range.end;
    if (value < this.range.start) return this.range.start;
    return value;
  },
  setValue: function(sliderValue, handleIdx){
    if (!this.active) {
      this.activeHandleIdx = handleIdx || 0;
      this.activeHandle    = this.handles[this.activeHandleIdx];
      this.updateStyles();
    }
    handleIdx = handleIdx || this.activeHandleIdx || 0;
    if (this.initialized && this.restricted) {
      if ((handleIdx>0) && (sliderValue<this.values[handleIdx-1]))
        sliderValue = this.values[handleIdx-1];
      if ((handleIdx < (this.handles.length-1)) && (sliderValue>this.values[handleIdx+1]))
        sliderValue = this.values[handleIdx+1];
    }
    sliderValue = this.getNearestValue(sliderValue);
    this.values[handleIdx] = sliderValue;
    this.value = this.values[0]; // assure backwards compat
    
    this.handles[handleIdx].style[this.isVertical() ? 'top' : 'left'] = 
      this.translateToPx(sliderValue);
    
    this.drawSpans();
    if (!this.dragging || !this.event) this.updateFinished();
  },
  setValueBy: function(delta, handleIdx) {
    this.setValue(this.values[handleIdx || this.activeHandleIdx || 0] + delta, 
      handleIdx || this.activeHandleIdx || 0);
  },
  translateToPx: function(value) {
    return Math.round(
      ((this.trackLength-this.handleLength)/(this.range.end-this.range.start)) * 
      (value - this.range.start)) + "px";
  },
  translateToValue: function(offset) {
    return ((offset/(this.trackLength-this.handleLength) * 
      (this.range.end-this.range.start)) + this.range.start);
  },
  getRange: function(range) {
    var v = this.values.sortBy(Prototype.K); 
    range = range || 0;
    return $R(v[range],v[range+1]);
  },
  minimumOffset: function(){
    return(this.isVertical() ? this.alignY : this.alignX);
  },
  maximumOffset: function(){
    return(this.isVertical() ? 
      (this.track.offsetHeight != 0 ? this.track.offsetHeight :
        this.track.style.height.replace(/px$/,"")) - this.alignY : 
      (this.track.offsetWidth != 0 ? this.track.offsetWidth : 
        this.track.style.width.replace(/px$/,"")) - this.alignX);
  },  
  isVertical:  function(){
    return (this.axis == 'vertical');
  },
  drawSpans: function() {
    var slider = this;
    if (this.spans)
      $R(0, this.spans.length-1).each(function(r) { slider.setSpan(slider.spans[r], slider.getRange(r)) });
    if (this.options.startSpan)
      this.setSpan(this.options.startSpan,
        $R(0, this.values.length>1 ? this.getRange(0).min() : this.value ));
    if (this.options.endSpan)
      this.setSpan(this.options.endSpan, 
        $R(this.values.length>1 ? this.getRange(this.spans.length-1).max() : this.value, this.maximum));
  },
  setSpan: function(span, range) {
    if (this.isVertical()) {
      span.style.top = this.translateToPx(range.start);
      span.style.height = this.translateToPx(range.end - range.start + this.range.start);
    } else {
      span.style.left = this.translateToPx(range.start);
      span.style.width = this.translateToPx(range.end - range.start + this.range.start);
    }
  },
  updateStyles: function() {
    this.handles.each( function(h){ Element.removeClassName(h, 'selected') });
    Element.addClassName(this.activeHandle, 'selected');
  },
  startDrag: function(event) {
    if (Event.isLeftClick(event)) {
      if (!this.disabled){
        this.active = true;
        
        var handle = Event.element(event);
        var flInverseZoom = 1 / (document.body.style.zoom || 1);
        var pointer  = [Event.pointerX(event) * flInverseZoom, Event.pointerY(event) * flInverseZoom];
        var track = handle;
        if (track==this.track) {
          var offsets  = Position.cumulativeOffset(this.track); 
          this.event = event;
          this.setValue(this.translateToValue( 
           (this.isVertical() ? pointer[1]-offsets[1] : pointer[0]-offsets[0])-(this.handleLength/2)
          ));
          var offsets  = Position.cumulativeOffset(this.activeHandle);
          this.offsetX = (pointer[0] - offsets[0]);
          this.offsetY = (pointer[1] - offsets[1]);
        } else {
          // find the handle (prevents issues with Safari)
          while((this.handles.indexOf(handle) == -1) && handle.parentNode) 
            handle = handle.parentNode;
            
          if (this.handles.indexOf(handle)!=-1) {
            this.activeHandle    = handle;
            this.activeHandleIdx = this.handles.indexOf(this.activeHandle);
            this.updateStyles();
            
            var offsets  = Position.cumulativeOffset(this.activeHandle);
            this.offsetX = (pointer[0] - offsets[0]);
            this.offsetY = (pointer[1] - offsets[1]);
          }
        }
      }
      Event.stop(event);
    }
  },
  update: function(event) {
   if (this.active) {
      if (!this.dragging) this.dragging = true;
      this.draw(event);
      if (Prototype.Browser.WebKit) window.scrollBy(0,0);
      Event.stop(event);
   }
  },
  draw: function(event) {
    var flInverseZoom = 1 / (document.body.style.zoom || 1);
    var pointer = [Event.pointerX(event) * flInverseZoom, Event.pointerY(event) * flInverseZoom];
    var offsets = Position.cumulativeOffset(this.track);
    pointer[0] -= this.offsetX + offsets[0];
    pointer[1] -= this.offsetY + offsets[1];
    this.event = event;
    this.setValue(this.translateToValue( this.isVertical() ? pointer[1] : pointer[0] ));
    if (this.initialized && this.options.onSlide)
      this.options.onSlide(this.values.length>1 ? this.values : this.value, this);
  },
  endDrag: function(event) {
    if (this.active && this.dragging) {
      this.finishDrag(event, true);
      Event.stop(event);
    }
    this.active = false;
    this.dragging = false;
  },  
  finishDrag: function(event, success) {
    this.active = false;
    this.dragging = false;
    this.updateFinished();
  },
  updateFinished: function() {
    if (this.initialized && this.options.onChange) 
      this.options.onChange(this.values.length>1 ? this.values : this.value, this);
    this.event = null;
  }
});

// script.aculo.us dragdrop.js v1.8.1, Thu Jan 03 22:07:12 -0500 2008

// Copyright (c) 2005-2007 Thomas Fuchs (http://script.aculo.us, http://mir.aculo.us)
//           (c) 2005-2007 Sammi Williams (http://www.oriontransfer.co.nz, sammi@oriontransfer.co.nz)
//
// script.aculo.us is freely distributable under the terms of an MIT-style license.
// For details, see the script.aculo.us web site: http://script.aculo.us/

if(Object.isUndefined(Effect))
  throw("dragdrop.js requires including script.aculo.us' effects.js library");

var Droppables = {
  drops: [],

  remove: function(element) {
    this.drops = this.drops.reject(function(d) { return d.element==$(element) });
  },

  add: function(element) {
    element = $(element);
    var options = Object.extend({
      greedy:     true,
      hoverclass: null,
      tree:       false
    }, arguments[1] || { });

    // cache containers
    if(options.containment) {
      options._containers = [];
      var containment = options.containment;
      if(Object.isArray(containment)) {
        containment.each( function(c) { options._containers.push($(c)) });
      } else {
        options._containers.push($(containment));
      }
    }

    if(options.accept) options.accept = [options.accept].flatten();

    Element.makePositioned(element); // fix IE
    options.element = element;

    this.drops.push(options);
  },

  findDeepestChild: function(drops) {
    deepest = drops[0];

    for (i = 1; i < drops.length; ++i)
      if (Element.isParent(drops[i].element, deepest.element))
        deepest = drops[i];

    return deepest;
  },

  isContained: function(element, drop) {
    var containmentNode;
    if(drop.tree) {
      containmentNode = element.treeNode;
    } else {
      containmentNode = element.parentNode;
    }
    return drop._containers.detect(function(c) { return containmentNode == c });
  },

  isAffected: function(point, element, drop) {
    return (
      (drop.element!=element) &&
      ((!drop._containers) ||
        this.isContained(element, drop)) &&
      ((!drop.accept) ||
        (Element.classNames(element).detect(
          function(v) { return drop.accept.include(v) } ) )) &&
      Position.within(drop.element, point[0], point[1]) );
  },

  deactivate: function(drop) {
    if(drop.hoverclass)
      Element.removeClassName(drop.element, drop.hoverclass);
    this.last_active = null;
  },

  activate: function(drop) {
    if(drop.hoverclass)
      Element.addClassName(drop.element, drop.hoverclass);
    this.last_active = drop;
  },

  show: function(point, element) {
    if(!this.drops.length) return;
    var drop, affected = [];

    this.drops.each( function(drop) {
      if(Droppables.isAffected(point, element, drop))
        affected.push(drop);
    });

    if(affected.length>0)
      drop = Droppables.findDeepestChild(affected);

    if(this.last_active && this.last_active != drop) this.deactivate(this.last_active);
    if (drop) {
      Position.within(drop.element, point[0], point[1]);
      if(drop.onHover)
        drop.onHover(element, drop.element, Position.overlap(drop.overlap, drop.element));

      if (drop != this.last_active) Droppables.activate(drop);
    }
  },

  fire: function(event, element) {
    if(!this.last_active) return;
    Position.prepare();

    var flInverseZoom = 1 / (document.body.style.zoom || 1);
    if (this.isAffected([Event.pointerX(event) * flInverseZoom, Event.pointerY(event) * flInverseZoom], element, this.last_active))
      if (this.last_active.onDrop) {
        this.last_active.onDrop(element, this.last_active.element, event);
        return true;
      }
  },

  reset: function() {
    if(this.last_active)
      this.deactivate(this.last_active);
  }
}

var Draggables = {
  drags: [],
  observers: [],

  register: function(draggable) {
    if(this.drags.length == 0) {
      this.eventMouseUp   = this.endDrag.bindAsEventListener(this);
      this.eventMouseMove = this.updateDrag.bindAsEventListener(this);
      this.eventKeypress  = this.keyPress.bindAsEventListener(this);

      Event.observe(document, "mouseup", this.eventMouseUp);
      Event.observe(document, "mousemove", this.eventMouseMove);
      Event.observe(document, "keypress", this.eventKeypress);
    }
    this.drags.push(draggable);
  },

  unregister: function(draggable) {
    this.drags = this.drags.reject(function(d) { return d==draggable });
    if(this.drags.length == 0) {
      Event.stopObserving(document, "mouseup", this.eventMouseUp);
      Event.stopObserving(document, "mousemove", this.eventMouseMove);
      Event.stopObserving(document, "keypress", this.eventKeypress);
    }
  },

  activate: function(draggable) {
    if(draggable.options.delay) {
      this._timeout = setTimeout(function() {
        Draggables._timeout = null;
        window.focus();
        Draggables.activeDraggable = draggable;
      }.bind(this), draggable.options.delay);
    } else {
      window.focus(); // allows keypress events if window isn't currently focused, fails for Safari
      this.activeDraggable = draggable;
    }
  },

  deactivate: function() {
    this.activeDraggable = null;
  },

  updateDrag: function(event) {
    if(!this.activeDraggable) return;
    var flInverseZoom = 1 / (document.body.style.zoom || 1);
    var pointer = [Event.pointerX(event) * flInverseZoom, Event.pointerY(event) * flInverseZoom];
    // Mozilla-based browsers fire successive mousemove events with
    // the same coordinates, prevent needless redrawing (moz bug?)
    if(this._lastPointer && (this._lastPointer.inspect() == pointer.inspect())) return;
    this._lastPointer = pointer;

    this.activeDraggable.updateDrag(event, pointer);
  },

  endDrag: function(event) {
    if(this._timeout) {
      clearTimeout(this._timeout);
      this._timeout = null;
    }
    if(!this.activeDraggable) return;
    this._lastPointer = null;
    this.activeDraggable.endDrag(event);
    this.activeDraggable = null;
  },

  keyPress: function(event) {
    if(this.activeDraggable)
      this.activeDraggable.keyPress(event);
  },

  addObserver: function(observer) {
    this.observers.push(observer);
    this._cacheObserverCallbacks();
  },

  removeObserver: function(element) {  // element instead of observer fixes mem leaks
    this.observers = this.observers.reject( function(o) { return o.element==element });
    this._cacheObserverCallbacks();
  },

  notify: function(eventName, draggable, event) {  // 'onStart', 'onEnd', 'onDrag'
    if(this[eventName+'Count'] > 0)
      this.observers.each( function(o) {
        if(o[eventName]) o[eventName](eventName, draggable, event);
      });
    if(draggable.options[eventName]) draggable.options[eventName](draggable, event);
  },

  _cacheObserverCallbacks: function() {
    ['onStart','onEnd','onDrag'].each( function(eventName) {
      Draggables[eventName+'Count'] = Draggables.observers.select(
        function(o) { return o[eventName]; }
      ).length;
    });
  }
}

/*--------------------------------------------------------------------------*/

var Draggable = Class.create({
  initialize: function(element) {
    var defaults = {
      handle: false,
      reverteffect: function(element, top_offset, left_offset) {
        var dur = Math.sqrt(Math.abs(top_offset^2)+Math.abs(left_offset^2))*0.02;
        new Effect.Move(element, { x: -left_offset, y: -top_offset, duration: dur,
          queue: {scope:'_draggable', position:'end'}
        });
      },
      endeffect: function(element) {
        var toOpacity = Object.isNumber(element._opacity) ? element._opacity : 1.0;
        new Effect.Opacity(element, {duration:0.2, from:0.7, to:toOpacity,
          queue: {scope:'_draggable', position:'end'},
          afterFinish: function(){
            Draggable._dragging[element] = false
          }
        });
      },
      zindex: 1000,
      revert: false,
      quiet: false,
      scroll: false,
      scrollSensitivity: 20,
      scrollSpeed: 15,
      snap: false,  // false, or xy or [x,y] or function(x,y){ return [x,y] }
      delay: 0
    };

    if(!arguments[1] || Object.isUndefined(arguments[1].endeffect))
      Object.extend(defaults, {
        starteffect: function(element) {
          element._opacity = Element.getOpacity(element);
          Draggable._dragging[element] = true;
          new Effect.Opacity(element, {duration:0.2, from:element._opacity, to:0.7});
        }
      });

    var options = Object.extend(defaults, arguments[1] || { });

    this.element = $(element);

    if(options.handle && Object.isString(options.handle))
      this.handle = this.element.down('.'+options.handle, 0);

    if(!this.handle) this.handle = $(options.handle);
    if(!this.handle) this.handle = this.element;

    if(options.scroll && !options.scroll.scrollTo && !options.scroll.outerHTML) {
      options.scroll = $(options.scroll);
      this._isScrollChild = Element.childOf(this.element, options.scroll);
    }

    Element.makePositioned(this.element); // fix IE

    this.options  = options;
    this.dragging = false;

    this.eventMouseDown = this.initDrag.bindAsEventListener(this);
    Event.observe(this.handle, "mousedown", this.eventMouseDown);

    Draggables.register(this);
  },

  destroy: function() {
    Event.stopObserving(this.handle, "mousedown", this.eventMouseDown);
    Draggables.unregister(this);
  },

  currentDelta: function() {
    return([
      parseInt(Element.getStyle(this.element,'left') || '0'),
      parseInt(Element.getStyle(this.element,'top') || '0')]);
  },

  initDrag: function(event) {
    if(!Object.isUndefined(Draggable._dragging[this.element]) &&
      Draggable._dragging[this.element]) return;
    if(Event.isLeftClick(event)) {
      // abort on form elements, fixes a Firefox issue
      var src = Event.element(event);
      if((tag_name = src.tagName.toUpperCase()) && (
        tag_name=='INPUT' ||
        tag_name=='SELECT' ||
        tag_name=='OPTION' ||
        tag_name=='BUTTON' ||
        tag_name=='TEXTAREA')) return;

      var flInverseZoom = 1 / (document.body.style.zoom || 1);
      var pointer = [Event.pointerX(event) * flInverseZoom, Event.pointerY(event) * flInverseZoom];
      var pos     = Position.cumulativeOffset(this.element);
      this.offset = [0,1].map( function(i) { return (pointer[i] - pos[i]) });

      Draggables.activate(this);
      Event.stop(event);
    }
  },

  startDrag: function(event) {
    this.dragging = true;
    if(!this.delta)
      this.delta = this.currentDelta();

    if(this.options.zindex) {
      this.originalZ = parseInt(Element.getStyle(this.element,'z-index') || '');
      this.element.style.zIndex = this.options.zindex;
    }

    if(this.options.ghosting) {
      this._clone = this.element.cloneNode(true);
      this.element._originallyAbsolute = (this.element.getStyle('position') == 'absolute');
      if (!this.element._originallyAbsolute)
        Position.absolutize(this.element);
      this.element.parentNode.insertBefore(this._clone, this.element);
    }

    if(this.options.scroll) {
      if (this.options.scroll == window) {
        var where = this._getWindowScroll(this.options.scroll);
        this.originalScrollLeft = where.left;
        this.originalScrollTop = where.top;
      } else {
        this.originalScrollLeft = this.options.scroll.scrollLeft;
        this.originalScrollTop = this.options.scroll.scrollTop;
      }
    }

    Draggables.notify('onStart', this, event);

    if(this.options.starteffect) this.options.starteffect(this.element);
  },

  updateDrag: function(event, pointer) {
    if(!this.dragging) this.startDrag(event);

    if(!this.options.quiet){
      Position.prepare();
      Droppables.show(pointer, this.element);
    }

    Draggables.notify('onDrag', this, event);

    this.draw(pointer);
    if(this.options.change) this.options.change(this);

    if(this.options.scroll) {
      this.stopScrolling();

      var p;
      if (this.options.scroll == window) {
        with(this._getWindowScroll(this.options.scroll)) { p = [ left, top, left+width, top+height ]; }
      } else {
        p = Position.page(this.options.scroll);
        p[0] += this.options.scroll.scrollLeft + Position.deltaX;
        p[1] += this.options.scroll.scrollTop + Position.deltaY;
        p.push(p[0]+this.options.scroll.offsetWidth);
        p.push(p[1]+this.options.scroll.offsetHeight);
      }
      var speed = [0,0];
      if(pointer[0] < (p[0]+this.options.scrollSensitivity)) speed[0] = pointer[0]-(p[0]+this.options.scrollSensitivity);
      if(pointer[1] < (p[1]+this.options.scrollSensitivity)) speed[1] = pointer[1]-(p[1]+this.options.scrollSensitivity);
      if(pointer[0] > (p[2]-this.options.scrollSensitivity)) speed[0] = pointer[0]-(p[2]-this.options.scrollSensitivity);
      if(pointer[1] > (p[3]-this.options.scrollSensitivity)) speed[1] = pointer[1]-(p[3]-this.options.scrollSensitivity);
      this.startScrolling(speed);
    }

    // fix AppleWebKit rendering
    if(Prototype.Browser.WebKit) window.scrollBy(0,0);

    Event.stop(event);
  },

  finishDrag: function(event, success) {
    this.dragging = false;

    if(this.options.quiet){
      Position.prepare();
      var flInverseZoom = 1 / (document.body.style.zoom || 1);
      var pointer = [Event.pointerX(event) * flInverseZoom, Event.pointerY(event) * flInverseZoom];
      Droppables.show(pointer, this.element);
    }

    if(this.options.ghosting) {
      if (!this.element._originallyAbsolute)
        Position.relativize(this.element);
      delete this.element._originallyAbsolute;
      Element.remove(this._clone);
      this._clone = null;
    }

    var dropped = false;
    if(success) {
      dropped = Droppables.fire(event, this.element);
      if (!dropped) dropped = false;
    }
    if(dropped && this.options.onDropped) this.options.onDropped(this.element);
    Draggables.notify('onEnd', this, event);

    var revert = this.options.revert;
    if(revert && Object.isFunction(revert)) revert = revert(this.element);

    var d = this.currentDelta();
    if(revert && this.options.reverteffect) {
      if (dropped == 0 || revert != 'failure')
        this.options.reverteffect(this.element,
          d[1]-this.delta[1], d[0]-this.delta[0]);
    } else {
      this.delta = d;
    }

    if(this.options.zindex)
      this.element.style.zIndex = this.originalZ;

    if(this.options.endeffect)
      this.options.endeffect(this.element);

    Draggables.deactivate(this);
    Droppables.reset();
  },

  keyPress: function(event) {
    if(event.keyCode!=Event.KEY_ESC) return;
    this.finishDrag(event, false);
    Event.stop(event);
  },

  endDrag: function(event) {
    if(!this.dragging) return;
    this.stopScrolling();
    this.finishDrag(event, true);
    Event.stop(event);
  },

  draw: function(point) {
    var pos = Position.cumulativeOffset(this.element);
    if(this.options.ghosting) {
      var r   = Position.realOffset(this.element);
      pos[0] += r[0] - Position.deltaX;
      pos[1] += r[1] - Position.deltaY;
    }

    var d = this.currentDelta();

    pos[0] -= d[0];
    pos[1] -= d[1];

    if(this.options.scroll && (this.options.scroll != window && this._isScrollChild)) {
      pos[0] -= this.options.scroll.scrollLeft-this.originalScrollLeft;
      pos[1] -= this.options.scroll.scrollTop-this.originalScrollTop;
    }

    var p = [0,1].map(function(i){
      return (point[i]-pos[i]-this.offset[i])
    }.bind(this));

    if(this.options.snap) {
      if(Object.isFunction(this.options.snap)) {
        p = this.options.snap(p[0],p[1],this);
      } else {
      if(Object.isArray(this.options.snap)) {
        p = p.map( function(v, i) {
          return (v/this.options.snap[i]).round()*this.options.snap[i] }.bind(this))
      } else {
        p = p.map( function(v) {
          return (v/this.options.snap).round()*this.options.snap }.bind(this))
      }
    }}

    var style = this.element.style;
    if((!this.options.constraint) || (this.options.constraint=='horizontal'))
      style.left = p[0] + "px";
    if((!this.options.constraint) || (this.options.constraint=='vertical'))
      style.top  = p[1] + "px";

    if(style.visibility=="hidden") style.visibility = ""; // fix gecko rendering
  },

  stopScrolling: function() {
    if(this.scrollInterval) {
      clearInterval(this.scrollInterval);
      this.scrollInterval = null;
      Draggables._lastScrollPointer = null;
    }
  },

  startScrolling: function(speed) {
    if(!(speed[0] || speed[1])) return;
    this.scrollSpeed = [speed[0]*this.options.scrollSpeed,speed[1]*this.options.scrollSpeed];
    this.lastScrolled = new Date();
    this.scrollInterval = setInterval(this.scroll.bind(this), 10);
  },

  scroll: function() {
    var current = new Date();
    var delta = current - this.lastScrolled;
    this.lastScrolled = current;
    if(this.options.scroll == window) {
      with (this._getWindowScroll(this.options.scroll)) {
        if (this.scrollSpeed[0] || this.scrollSpeed[1]) {
          var d = delta / 1000;
          this.options.scroll.scrollTo( left + d*this.scrollSpeed[0], top + d*this.scrollSpeed[1] );
        }
      }
    } else {
      this.options.scroll.scrollLeft += this.scrollSpeed[0] * delta / 1000;
      this.options.scroll.scrollTop  += this.scrollSpeed[1] * delta / 1000;
    }

    Position.prepare();
    Droppables.show(Draggables._lastPointer, this.element);
    Draggables.notify('onDrag', this);
    if (this._isScrollChild) {
      Draggables._lastScrollPointer = Draggables._lastScrollPointer || $A(Draggables._lastPointer);
      Draggables._lastScrollPointer[0] += this.scrollSpeed[0] * delta / 1000;
      Draggables._lastScrollPointer[1] += this.scrollSpeed[1] * delta / 1000;
      if (Draggables._lastScrollPointer[0] < 0)
        Draggables._lastScrollPointer[0] = 0;
      if (Draggables._lastScrollPointer[1] < 0)
        Draggables._lastScrollPointer[1] = 0;
      this.draw(Draggables._lastScrollPointer);
    }

    if(this.options.change) this.options.change(this);
  },

  _getWindowScroll: function(w) {
    var T, L, W, H;
    with (w.document) {
      if (w.document.documentElement && documentElement.scrollTop) {
        T = documentElement.scrollTop;
        L = documentElement.scrollLeft;
      } else if (w.document.body) {
        T = body.scrollTop;
        L = body.scrollLeft;
      }
      if (w.innerWidth) {
        W = w.innerWidth;
        H = w.innerHeight;
      } else if (w.document.documentElement && documentElement.clientWidth) {
        W = documentElement.clientWidth;
        H = documentElement.clientHeight;
      } else {
        W = body.offsetWidth;
        H = body.offsetHeight
      }
    }
    return { top: T, left: L, width: W, height: H };
  }
});

Draggable._dragging = { };

/*--------------------------------------------------------------------------*/

var SortableObserver = Class.create({
  initialize: function(element, observer) {
    this.element   = $(element);
    this.observer  = observer;
    this.lastValue = Sortable.serialize(this.element);
  },

  onStart: function() {
    this.lastValue = Sortable.serialize(this.element);
  },

  onEnd: function() {
    Sortable.unmark();
    if(this.lastValue != Sortable.serialize(this.element))
      this.observer(this.element)
  }
});

var Sortable = {
  SERIALIZE_RULE: /^[^_\-](?:[A-Za-z0-9\-\_]*)[_](.*)$/,

  sortables: { },

  _findRootElement: function(element) {
    while (element.tagName.toUpperCase() != "BODY") {
      if(element.id && Sortable.sortables[element.id]) return element;
      element = element.parentNode;
    }
  },

  options: function(element) {
    element = Sortable._findRootElement($(element));
    if(!element) return;
    return Sortable.sortables[element.id];
  },

  destroy: function(element){
    var s = Sortable.options(element);

    if(s) {
      Draggables.removeObserver(s.element);
      s.droppables.each(function(d){ Droppables.remove(d) });
      s.draggables.invoke('destroy');

      delete Sortable.sortables[s.element.id];
    }
  },

  create: function(element) {
    element = $(element);
    var options = Object.extend({
      element:     element,
      tag:         'li',       // assumes li children, override with tag: 'tagname'
      dropOnEmpty: false,
      tree:        false,
      treeTag:     'ul',
      overlap:     'vertical', // one of 'vertical', 'horizontal'
      constraint:  'vertical', // one of 'vertical', 'horizontal', false
      containment: element,    // also takes array of elements (or id's); or false
      handle:      false,      // or a CSS class
      only:        false,
      delay:       0,
      hoverclass:  null,
      ghosting:    false,
      quiet:       false,
      scroll:      false,
      scrollSensitivity: 20,
      scrollSpeed: 15,
      format:      this.SERIALIZE_RULE,

      // these take arrays of elements or ids and can be
      // used for better initialization performance
      elements:    false,
      handles:     false,

      onChange:    Prototype.emptyFunction,
      onUpdate:    Prototype.emptyFunction
    }, arguments[1] || { });

    // clear any old sortable with same element
    this.destroy(element);

    // build options for the draggables
    var options_for_draggable = {
      revert:      true,
      quiet:       options.quiet,
      scroll:      options.scroll,
      scrollSpeed: options.scrollSpeed,
      scrollSensitivity: options.scrollSensitivity,
      delay:       options.delay,
      ghosting:    options.ghosting,
      constraint:  options.constraint,
      handle:      options.handle };

    if(options.starteffect)
      options_for_draggable.starteffect = options.starteffect;

    if(options.reverteffect)
      options_for_draggable.reverteffect = options.reverteffect;
    else
      if(options.ghosting) options_for_draggable.reverteffect = function(element) {
        element.style.top  = 0;
        element.style.left = 0;
      };

    if(options.endeffect)
      options_for_draggable.endeffect = options.endeffect;

    if(options.zindex)
      options_for_draggable.zindex = options.zindex;

    // build options for the droppables
    var options_for_droppable = {
      overlap:     options.overlap,
      containment: options.containment,
      tree:        options.tree,
      hoverclass:  options.hoverclass,
      onHover:     Sortable.onHover
    }

    var options_for_tree = {
      onHover:      Sortable.onEmptyHover,
      overlap:      options.overlap,
      containment:  options.containment,
      hoverclass:   options.hoverclass
    }

    // fix for gecko engine
    Element.cleanWhitespace(element);

    options.draggables = [];
    options.droppables = [];

    // drop on empty handling
    if(options.dropOnEmpty || options.tree) {
      Droppables.add(element, options_for_tree);
      options.droppables.push(element);
    }

    (options.elements || this.findElements(element, options) || []).each( function(e,i) {
      var handle = options.handles ? $(options.handles[i]) :
        (options.handle ? $(e).select('.' + options.handle)[0] : e);
      options.draggables.push(
        new Draggable(e, Object.extend(options_for_draggable, { handle: handle })));
      Droppables.add(e, options_for_droppable);
      if(options.tree) e.treeNode = element;
      options.droppables.push(e);
    });

    if(options.tree) {
      (Sortable.findTreeElements(element, options) || []).each( function(e) {
        Droppables.add(e, options_for_tree);
        e.treeNode = element;
        options.droppables.push(e);
      });
    }

    // keep reference
    this.sortables[element.id] = options;

    // for onupdate
    Draggables.addObserver(new SortableObserver(element, options.onUpdate));

  },

  // return all suitable-for-sortable elements in a guaranteed order
  findElements: function(element, options) {
    return Element.findChildren(
      element, options.only, options.tree ? true : false, options.tag);
  },

  findTreeElements: function(element, options) {
    return Element.findChildren(
      element, options.only, options.tree ? true : false, options.treeTag);
  },

  onHover: function(element, dropon, overlap) {
    if(Element.isParent(dropon, element)) return;

    if(overlap > .33 && overlap < .66 && Sortable.options(dropon).tree) {
      return;
    } else if(overlap>0.5) {
      Sortable.mark(dropon, 'before');
      if(dropon.previousSibling != element) {
        var oldParentNode = element.parentNode;
        element.style.visibility = "hidden"; // fix gecko rendering
        dropon.parentNode.insertBefore(element, dropon);
        if(dropon.parentNode!=oldParentNode)
          Sortable.options(oldParentNode).onChange(element);
        Sortable.options(dropon.parentNode).onChange(element);
      }
    } else {
      Sortable.mark(dropon, 'after');
      var nextElement = dropon.nextSibling || null;
      if(nextElement != element) {
        var oldParentNode = element.parentNode;
        element.style.visibility = "hidden"; // fix gecko rendering
        dropon.parentNode.insertBefore(element, nextElement);
        if(dropon.parentNode!=oldParentNode)
          Sortable.options(oldParentNode).onChange(element);
        Sortable.options(dropon.parentNode).onChange(element);
      }
    }
  },

  onEmptyHover: function(element, dropon, overlap) {
    var oldParentNode = element.parentNode;
    var droponOptions = Sortable.options(dropon);

    if(!Element.isParent(dropon, element)) {
      var index;

      var children = Sortable.findElements(dropon, {tag: droponOptions.tag, only: droponOptions.only});
      var child = null;

      if(children) {
        var offset = Element.offsetSize(dropon, droponOptions.overlap) * (1.0 - overlap);

        for (index = 0; index < children.length; index += 1) {
          if (offset - Element.offsetSize (children[index], droponOptions.overlap) >= 0) {
            offset -= Element.offsetSize (children[index], droponOptions.overlap);
          } else if (offset - (Element.offsetSize (children[index], droponOptions.overlap) / 2) >= 0) {
            child = index + 1 < children.length ? children[index + 1] : null;
            break;
          } else {
            child = children[index];
            break;
          }
        }
      }

      dropon.insertBefore(element, child);

      Sortable.options(oldParentNode).onChange(element);
      droponOptions.onChange(element);
    }
  },

  unmark: function() {
    if(Sortable._marker) Sortable._marker.hide();
  },

  mark: function(dropon, position) {
    // mark on ghosting only
    var sortable = Sortable.options(dropon.parentNode);
    if(sortable && !sortable.ghosting) return;

    if(!Sortable._marker) {
      Sortable._marker =
        ($('dropmarker') || Element.extend(document.createElement('DIV'))).
          hide().addClassName('dropmarker').setStyle({position:'absolute'});
      document.getElementsByTagName("body").item(0).appendChild(Sortable._marker);
    }
    var offsets = Position.cumulativeOffset(dropon);
    Sortable._marker.setStyle({left: offsets[0]+'px', top: offsets[1] + 'px'});

    if(position=='after')
      if(sortable.overlap == 'horizontal')
        Sortable._marker.setStyle({left: (offsets[0]+dropon.clientWidth) + 'px'});
      else
        Sortable._marker.setStyle({top: (offsets[1]+dropon.clientHeight) + 'px'});

    Sortable._marker.show();
  },

  _tree: function(element, options, parent) {
    var children = Sortable.findElements(element, options) || [];

    for (var i = 0; i < children.length; ++i) {
      var match = children[i].id.match(options.format);

      if (!match) continue;

      var child = {
        id: encodeURIComponent(match ? match[1] : null),
        element: element,
        parent: parent,
        children: [],
        position: parent.children.length,
        container: $(children[i]).down(options.treeTag)
      }

      /* Get the element containing the children and recurse over it */
      if (child.container)
        this._tree(child.container, options, child)

      parent.children.push (child);
    }

    return parent;
  },

  tree: function(element) {
    element = $(element);
    var sortableOptions = this.options(element);
    var options = Object.extend({
      tag: sortableOptions.tag,
      treeTag: sortableOptions.treeTag,
      only: sortableOptions.only,
      name: element.id,
      format: sortableOptions.format
    }, arguments[1] || { });

    var root = {
      id: null,
      parent: null,
      children: [],
      container: element,
      position: 0
    }

    return Sortable._tree(element, options, root);
  },

  /* Construct a [i] index for a particular node */
  _constructIndex: function(node) {
    var index = '';
    do {
      if (node.id) index = '[' + node.position + ']' + index;
    } while ((node = node.parent) != null);
    return index;
  },

  sequence: function(element) {
    element = $(element);
    var options = Object.extend(this.options(element), arguments[1] || { });

    return $(this.findElements(element, options) || []).map( function(item) {
      return item.id.match(options.format) ? item.id.match(options.format)[1] : '';
    });
  },

  setSequence: function(element, new_sequence) {
    element = $(element);
    var options = Object.extend(this.options(element), arguments[2] || { });

    var nodeMap = { };
    this.findElements(element, options).each( function(n) {
        if (n.id.match(options.format))
            nodeMap[n.id.match(options.format)[1]] = [n, n.parentNode];
        n.parentNode.removeChild(n);
    });

    new_sequence.each(function(ident) {
      var n = nodeMap[ident];
      if (n) {
        n[1].appendChild(n[0]);
        delete nodeMap[ident];
      }
    });
  },

  serialize: function(element) {
    element = $(element);
    var options = Object.extend(Sortable.options(element), arguments[1] || { });
    var name = encodeURIComponent(
      (arguments[1] && arguments[1].name) ? arguments[1].name : element.id);

    if (options.tree) {
      return Sortable.tree(element, arguments[1]).children.map( function (item) {
        return [name + Sortable._constructIndex(item) + "[id]=" +
                encodeURIComponent(item.id)].concat(item.children.map(arguments.callee));
      }).flatten().join('&');
    } else {
      return Sortable.sequence(element, arguments[1]).map( function(item) {
        return name + "[]=" + encodeURIComponent(item);
      }).join('&');
    }
  }
}

// Returns true if child is contained within element
Element.isParent = function(child, element) {
  if (!child.parentNode || child == element) return false;
  if (child.parentNode == element) return true;
  return Element.isParent(child.parentNode, element);
}

Element.findChildren = function(element, only, recursive, tagName) {
  if(!element.hasChildNodes()) return null;
  tagName = tagName.toUpperCase();
  if(only) only = [only].flatten();
  var elements = [];
  $A(element.childNodes).each( function(e) {
    if(e.tagName && e.tagName.toUpperCase()==tagName &&
      (!only || (Element.classNames(e).detect(function(v) { return only.include(v) }))))
        elements.push(e);
    if(recursive) {
      var grandchildren = Element.findChildren(e, only, recursive, tagName);
      if(grandchildren) elements.push(grandchildren);
    }
  });

  return (elements.length>0 ? elements.flatten() : []);
}

Element.offsetSize = function (element, type) {
  return element['offset' + ((type=='vertical' || type=='height') ? 'Height' : 'Width')];
}




var g_OnWebPanelShownHandlers = Array();
function SteamOnWebPanelShown()
{
	for ( var i = 0; i < g_OnWebPanelShownHandlers.length; i++ )
	{
		g_OnWebPanelShownHandlers[i]();
	}
}
function RegisterSteamOnWebPanelShownHandler( f )
{
	g_OnWebPanelShownHandlers.push( f );
}

var g_OnWebPanelHiddenHandlers = Array();
function SteamOnWebPanelHidden()
{
	for( var i = 0; i < g_OnWebPanelHiddenHandlers.length; i++ )
	{
		g_OnWebPanelHiddenHandlers[i]();
	}
}
function RegisterSteamOnWebPanelHiddenHandler( f )
{
	g_OnWebPanelHiddenHandlers.push( f );
}





function RefreshNotificationArea()
{
	// the new way - updates both the old envelope and responsive menu
	UpdateNotificationCounts();
}

function vIE()
{
	return (navigator.appName=='Microsoft Internet Explorer') ? parseFloat( ( new RegExp( "MSIE ([0-9]{1,}[.0-9]{0,})" ) ).exec( navigator.userAgent )[1] ) : -1;
}

function checkAbuseSub( elForm )
{
	if ( !$J(elForm).find('input[name=abuseType]:checked').length )
	{
		alert( 'Please select a reason for reporting abuse' );
		return false;
	}

	CModal.DismissActiveModal();

	var params = $J(elForm).serializeArray();
	params.push( {name: 'json', value: 1} );

	$J.post( 'http://steamcommunity.com/actions/ReportAbuse/', params).done( function() {
		ShowAlertDialog( 'Thank You!', 'Thank you for reporting offensive content and helping to keep Steam clean and friendly.' );
	}).fail( function() {
		ShowAlertDialog( 'Report Violation', 'There was a problem saving your report.  Please try again later.' );
	});
	return false;
}



var g_whiteListedDomains = [
	"steampowered.com",
	"steamgames.com",
	"steamcommunity.com",
	"valvesoftware.com",
	"youtube.com",
	"youtu.be",
	"live.com",
	"msn.com",
	"myspace.com",
	"facebook.com",
	"hi5.com",
	"wikipedia.org",
	"orkut.com",
	"blogger.com",
	"friendster.com",
	"fotolog.net",
	"google.fr",
	"baidu.com",
	"microsoft.com",
	"shacknews.com",
	"bbc.co.uk",
	"cnn.com",
	"foxsports.com",
	"pcmag.com",
	"nytimes.com",
	"flickr.com",
	"amazon.com",
	"veoh.com",
	"pcgamer.com",
	"metacritic.com",
	"fileplanet.com",
	"gamespot.com",
	"gametap.com",
	"ign.com",
	"kotaku.com",
	"xfire.com",
	"pcgames.gwn.com",
	"gamezone.com",
	"gamesradar.com",
	"digg.com",
	"engadget.com",
	"gizmodo.com",
	"gamesforwindows.com",
	"xbox.com",
	"cnet.com",
	"l4d.com",
	"teamfortress.com",
	"tf2.com",
	"half-life2.com",
	"aperturescience.com",
	"dayofdefeat.com",
	"dota2.com",
	"playdota.com",
	"kickstarter.com",
	"gamingheads.com",
	"reddit.com",
	"counter-strike.net",
	"imgur.com"
];

function getHostname( str )
{
	var re = new RegExp( '^(steam://openurl(_external)?/)?(f|ht)tps?://([^@/?#]*@)?([^/#?]+)', 'im' );
	return str.trim().match(re)[5].toString();
}

function AlertNonSteamSite( elem )
{
	var url = elem.href;
	var hostname = getHostname( url );
	if ( hostname )
	{
		hostname = hostname.toLowerCase();
		for ( var i = 0; i < g_whiteListedDomains.length; ++i )
		{
			var index = hostname.lastIndexOf( g_whiteListedDomains[i] );
			if ( index != -1 && index == ( hostname.length - g_whiteListedDomains[i].length )
				 && ( index == 0 || hostname.charAt( index - 1 ) == '.' ) )
			{
				return true;
			}
		}
		return confirm( 'Note: the URL you have clicked on is not an official Steam web site.\n\n'
						+ url.replace( new RegExp( '^steam://openurl(_external)?/' ), '' ) + '\n\n'
						+ 'If this web site asks for your user name or password, do not enter that information. You could lose your Steam account and all your games!\n'
						+ 'Are you sure you want to visit this page? Click OK to continue at your own risk.\n' );
	}

	ShowAlertDialog( '', 'The URL is badly formed.');
	return false;
}

var lastFilters = new Object();
function FilterListFast( target, str )
{
	var lastFilter = lastFilters[target];
	if ( !lastFilter )
		lastFilter = '';

	str = str.toLowerCase();
	if ( str == lastFilter )
		return false;

	var expanding = false;
	var contracting = false;
	if ( str.length > lastFilter.length && str.startsWith( lastFilter ) )
		expanding = true;
	if ( !str || str.length < lastFilter.length && lastFilter.startsWith( str ) )
		contracting = true;

	var strParts = str.split(/\W/);

	var elemTarget = $(target);
	var elemParent = elemTarget.parentNode;
	elemParent.removeChild( elemTarget );

	var rgChildren = elemTarget.childNodes;
	for ( var i = 0; i < rgChildren.length; i++ )
	{
		var child = rgChildren[i];
		if ( child.nodeType != child.ELEMENT_NODE )
			continue;
		if ( expanding && child.style.display=='none' || contracting && child.style.display != 'none' )
			continue;
		if ( !child.lcText )
			child.lcText = (child.innerText || child.textContent).toLowerCase();

		var text = child.lcText;
		var show = true;
		for ( var iPart = 0; show && iPart < strParts.length; iPart++ )
			if ( !text.include( strParts[iPart] ) )
				show=false;

		if ( show )
			child.style.display = '';
		else
			child.style.display = 'none';
	}
	lastFilters[target] = str;
	elemParent.appendChild( elemTarget );
	return true;
}


// goes into fullscreen, returning false if the browser doesn't support it
function requestFullScreen( element )
{
	// Supports most browsers and their versions.
	var requestMethod = element.requestFullScreen || element.webkitRequestFullScreen || element.mozRequestFullScreen || element.msRequestFullScreen;

	if (requestMethod)
	{
		// Native full screen.
		requestMethod.call(element);
		return true;
	}

	return false;
}

function exitFullScreen()
{
	if (document.exitFullscreen) {
		document.exitFullscreen();
	}
	else if (document.mozCancelFullScreen) {
		document.mozCancelFullScreen();
	}
	else if (document.webkitCancelFullScreen) {
		document.webkitCancelFullScreen();
	}
}

function RecordAJAXPageView( url )
{
	if ( typeof ga != "undefined" && ga )
	{
		var rgURLs = [ 'http://steamcommunity.com', 'http://steamcommunity.com' ];
		for ( var i = 0; i < rgURLs.length; ++i )
		{
			var baseURL = rgURLs[i];
			var idx = url.indexOf(baseURL);
			if ( idx != -1 )
			{
				url = url.substring( idx + baseURL.length );
			}
			ga( 'send', 'pageview', url );
			return;
		}
	}
}



// doesn't properly handle cookies with ; in them (needs to look for escape char)
function GetCookie( strCookieName )
{
	var rgMatches = document.cookie.match( '(^|; )' + strCookieName + '=([^;]*)' );
	if ( rgMatches && rgMatches[2] )
		return rgMatches[2];
	else
		return null;
}

function SetCookie( strCookieName, strValue, expiryInDays, path )
{
	if ( !expiryInDays )
		expiryInDays = 0;
	if ( !path )
		path = '/';
	
	var dateExpires = new Date();
	dateExpires.setTime( dateExpires.getTime() + 1000 * 60 * 60 * 24 * expiryInDays );
	document.cookie = strCookieName + '=' + strValue + '; expires=' + dateExpires.toGMTString() + ';path=' + path;
}

// included data: strCode, eCurrencyCode, strSymbol, bSymbolIsPrefix, bWholeUnitsOnly
g_rgCurrencyData = {"USD":{"strCode":"USD","eCurrencyCode":1,"strSymbol":"$","bSymbolIsPrefix":true,"bWholeUnitsOnly":false,"strDecimalSymbol":".","strThousandsSeparator":",","strSymbolAndNumberSeparator":""},"GBP":{"strCode":"GBP","eCurrencyCode":2,"strSymbol":"\u00a3","bSymbolIsPrefix":true,"bWholeUnitsOnly":false,"strDecimalSymbol":".","strThousandsSeparator":",","strSymbolAndNumberSeparator":""},"EUR":{"strCode":"EUR","eCurrencyCode":3,"strSymbol":"\u20ac","bSymbolIsPrefix":false,"bWholeUnitsOnly":false,"strDecimalSymbol":",","strThousandsSeparator":" ","strSymbolAndNumberSeparator":""},"CHF":{"strCode":"CHF","eCurrencyCode":4,"strSymbol":"CHF","bSymbolIsPrefix":true,"bWholeUnitsOnly":false,"strDecimalSymbol":".","strThousandsSeparator":" ","strSymbolAndNumberSeparator":" "},"RUB":{"strCode":"RUB","eCurrencyCode":5,"strSymbol":"p\u0443\u0431.","bSymbolIsPrefix":false,"bWholeUnitsOnly":true,"strDecimalSymbol":",","strThousandsSeparator":"","strSymbolAndNumberSeparator":" "},"BRL":{"strCode":"BRL","eCurrencyCode":7,"strSymbol":"R$","bSymbolIsPrefix":true,"bWholeUnitsOnly":false,"strDecimalSymbol":",","strThousandsSeparator":".","strSymbolAndNumberSeparator":" "},"JPY":{"strCode":"JPY","eCurrencyCode":8,"strSymbol":"\u00a5","bSymbolIsPrefix":true,"bWholeUnitsOnly":true,"strDecimalSymbol":".","strThousandsSeparator":",","strSymbolAndNumberSeparator":" "},"NOK":{"strCode":"NOK","eCurrencyCode":9,"strSymbol":"kr","bSymbolIsPrefix":false,"bWholeUnitsOnly":false,"strDecimalSymbol":",","strThousandsSeparator":".","strSymbolAndNumberSeparator":" "},"IDR":{"strCode":"IDR","eCurrencyCode":10,"strSymbol":"Rp","bSymbolIsPrefix":true,"bWholeUnitsOnly":true,"strDecimalSymbol":".","strThousandsSeparator":" ","strSymbolAndNumberSeparator":" "},"MYR":{"strCode":"MYR","eCurrencyCode":11,"strSymbol":"RM","bSymbolIsPrefix":true,"bWholeUnitsOnly":false,"strDecimalSymbol":".","strThousandsSeparator":",","strSymbolAndNumberSeparator":""},"PHP":{"strCode":"PHP","eCurrencyCode":12,"strSymbol":"P","bSymbolIsPrefix":true,"bWholeUnitsOnly":false,"strDecimalSymbol":".","strThousandsSeparator":",","strSymbolAndNumberSeparator":""},"SGD":{"strCode":"SGD","eCurrencyCode":13,"strSymbol":"S$","bSymbolIsPrefix":true,"bWholeUnitsOnly":false,"strDecimalSymbol":".","strThousandsSeparator":",","strSymbolAndNumberSeparator":""},"THB":{"strCode":"THB","eCurrencyCode":14,"strSymbol":"\u0e3f","bSymbolIsPrefix":true,"bWholeUnitsOnly":false,"strDecimalSymbol":".","strThousandsSeparator":",","strSymbolAndNumberSeparator":""},"VND":{"strCode":"VND","eCurrencyCode":15,"strSymbol":"\u20ab","bSymbolIsPrefix":false,"bWholeUnitsOnly":true,"strDecimalSymbol":",","strThousandsSeparator":".","strSymbolAndNumberSeparator":""},"KRW":{"strCode":"KRW","eCurrencyCode":16,"strSymbol":"\u20a9","bSymbolIsPrefix":true,"bWholeUnitsOnly":true,"strDecimalSymbol":".","strThousandsSeparator":",","strSymbolAndNumberSeparator":" "},"TRY":{"strCode":"TRY","eCurrencyCode":17,"strSymbol":"TL","bSymbolIsPrefix":false,"bWholeUnitsOnly":false,"strDecimalSymbol":",","strThousandsSeparator":".","strSymbolAndNumberSeparator":" "},"UAH":{"strCode":"UAH","eCurrencyCode":18,"strSymbol":"\u20b4","bSymbolIsPrefix":false,"bWholeUnitsOnly":true,"strDecimalSymbol":",","strThousandsSeparator":" ","strSymbolAndNumberSeparator":""},"MXN":{"strCode":"MXN","eCurrencyCode":19,"strSymbol":"Mex$","bSymbolIsPrefix":true,"bWholeUnitsOnly":false,"strDecimalSymbol":".","strThousandsSeparator":",","strSymbolAndNumberSeparator":" "},"CAD":{"strCode":"CAD","eCurrencyCode":20,"strSymbol":"CDN$","bSymbolIsPrefix":true,"bWholeUnitsOnly":false,"strDecimalSymbol":".","strThousandsSeparator":",","strSymbolAndNumberSeparator":" "},"AUD":{"strCode":"AUD","eCurrencyCode":21,"strSymbol":"A$","bSymbolIsPrefix":true,"bWholeUnitsOnly":false,"strDecimalSymbol":".","strThousandsSeparator":",","strSymbolAndNumberSeparator":" "},"NZD":{"strCode":"NZD","eCurrencyCode":22,"strSymbol":"NZ$","bSymbolIsPrefix":true,"bWholeUnitsOnly":false,"strDecimalSymbol":".","strThousandsSeparator":",","strSymbolAndNumberSeparator":" "},"PLN":{"strCode":"PLN","eCurrencyCode":6,"strSymbol":"z\u0142","bSymbolIsPrefix":false,"bWholeUnitsOnly":false,"strDecimalSymbol":",","strThousandsSeparator":" ","strSymbolAndNumberSeparator":""},"CNY":{"strCode":"CNY","eCurrencyCode":23,"strSymbol":"\u00a5","bSymbolIsPrefix":true,"bWholeUnitsOnly":true,"strDecimalSymbol":".","strThousandsSeparator":",","strSymbolAndNumberSeparator":" "},"INR":{"strCode":"INR","eCurrencyCode":24,"strSymbol":"\u20b9","bSymbolIsPrefix":true,"bWholeUnitsOnly":true,"strDecimalSymbol":".","strThousandsSeparator":",","strSymbolAndNumberSeparator":" "},"CLP":{"strCode":"CLP","eCurrencyCode":25,"strSymbol":"CLP$","bSymbolIsPrefix":true,"bWholeUnitsOnly":true,"strDecimalSymbol":",","strThousandsSeparator":".","strSymbolAndNumberSeparator":" "},"PEN":{"strCode":"PEN","eCurrencyCode":26,"strSymbol":"S\/.","bSymbolIsPrefix":true,"bWholeUnitsOnly":false,"strDecimalSymbol":".","strThousandsSeparator":",","strSymbolAndNumberSeparator":""},"COP":{"strCode":"COP","eCurrencyCode":27,"strSymbol":"COL$","bSymbolIsPrefix":true,"bWholeUnitsOnly":true,"strDecimalSymbol":",","strThousandsSeparator":".","strSymbolAndNumberSeparator":" "},"ZAR":{"strCode":"ZAR","eCurrencyCode":28,"strSymbol":"R","bSymbolIsPrefix":true,"bWholeUnitsOnly":false,"strDecimalSymbol":".","strThousandsSeparator":" ","strSymbolAndNumberSeparator":" "},"HKD":{"strCode":"HKD","eCurrencyCode":29,"strSymbol":"HK$","bSymbolIsPrefix":true,"bWholeUnitsOnly":false,"strDecimalSymbol":".","strThousandsSeparator":",","strSymbolAndNumberSeparator":" "},"TWD":{"strCode":"TWD","eCurrencyCode":30,"strSymbol":"NT$","bSymbolIsPrefix":true,"bWholeUnitsOnly":true,"strDecimalSymbol":".","strThousandsSeparator":",","strSymbolAndNumberSeparator":" "},"SAR":{"strCode":"SAR","eCurrencyCode":31,"strSymbol":"SR","bSymbolIsPrefix":false,"bWholeUnitsOnly":false,"strDecimalSymbol":".","strThousandsSeparator":",","strSymbolAndNumberSeparator":" "},"AED":{"strCode":"AED","eCurrencyCode":32,"strSymbol":"AED","bSymbolIsPrefix":false,"bWholeUnitsOnly":false,"strDecimalSymbol":".","strThousandsSeparator":",","strSymbolAndNumberSeparator":" "},"ARS":{"strCode":"ARS","eCurrencyCode":34,"strSymbol":"ARS$","bSymbolIsPrefix":true,"bWholeUnitsOnly":false,"strDecimalSymbol":",","strThousandsSeparator":".","strSymbolAndNumberSeparator":" "},"ILS":{"strCode":"ILS","eCurrencyCode":35,"strSymbol":"\u20aa","bSymbolIsPrefix":true,"bWholeUnitsOnly":false,"strDecimalSymbol":".","strThousandsSeparator":",","strSymbolAndNumberSeparator":""},"BYN":{"strCode":"BYN","eCurrencyCode":36,"strSymbol":"Br","bSymbolIsPrefix":true,"bWholeUnitsOnly":false,"strDecimalSymbol":".","strThousandsSeparator":",","strSymbolAndNumberSeparator":""},"KZT":{"strCode":"KZT","eCurrencyCode":37,"strSymbol":"\u20b8","bSymbolIsPrefix":false,"bWholeUnitsOnly":true,"strDecimalSymbol":",","strThousandsSeparator":" ","strSymbolAndNumberSeparator":""},"KWD":{"strCode":"KWD","eCurrencyCode":38,"strSymbol":"KD","bSymbolIsPrefix":false,"bWholeUnitsOnly":false,"strDecimalSymbol":".","strThousandsSeparator":",","strSymbolAndNumberSeparator":" "},"QAR":{"strCode":"QAR","eCurrencyCode":39,"strSymbol":"QR","bSymbolIsPrefix":false,"bWholeUnitsOnly":false,"strDecimalSymbol":".","strThousandsSeparator":",","strSymbolAndNumberSeparator":" "},"CRC":{"strCode":"CRC","eCurrencyCode":40,"strSymbol":"\u20a1","bSymbolIsPrefix":true,"bWholeUnitsOnly":true,"strDecimalSymbol":",","strThousandsSeparator":".","strSymbolAndNumberSeparator":""},"UYU":{"strCode":"UYU","eCurrencyCode":41,"strSymbol":"$U","bSymbolIsPrefix":true,"bWholeUnitsOnly":true,"strDecimalSymbol":",","strThousandsSeparator":".","strSymbolAndNumberSeparator":""},"RMB":{"strCode":"RMB","eCurrencyCode":9000,"strSymbol":"\u5200\u5e01","bSymbolIsPrefix":false,"bWholeUnitsOnly":true,"strDecimalSymbol":".","strThousandsSeparator":"","strSymbolAndNumberSeparator":" "},"NXP":{"strCode":"NXP","eCurrencyCode":9001,"strSymbol":"\uc6d0","bSymbolIsPrefix":false,"bWholeUnitsOnly":true,"strDecimalSymbol":".","strThousandsSeparator":",","strSymbolAndNumberSeparator":""}};


// takes an integer
function v_currencyformat( valueInCents, currencyCode, countryCode )
{
	var currencyFormat = (valueInCents / 100).toFixed(2);

	if ( g_rgCurrencyData[currencyCode] )
	{
		var currencyData = g_rgCurrencyData[currencyCode];
		if ( IsCurrencyWholeUnits( currencyCode ) )
		{
			currencyFormat = currencyFormat.replace( '.00', '' );
		}
		
		if ( currencyData.strDecimalSymbol != '.' )
		{
			currencyFormat = currencyFormat.replace( '.', currencyData.strDecimalSymbol );
		}
		
		var currencyReturn = IsCurrencySymbolBeforeValue( currencyCode ) ?
			 GetCurrencySymbol( currencyCode ) + currencyData.strSymbolAndNumberSeparator + currencyFormat 
			 : currencyFormat + currencyData.strSymbolAndNumberSeparator + GetCurrencySymbol( currencyCode );
		
		if ( currencyCode == 'USD' && typeof(countryCode) != 'undefined' && countryCode != 'US' )
		{
			return currencyReturn + ' USD';
		}
		else if ( currencyCode == 'EUR' )
		{
			return currencyReturn.replace( ',00', ',--' );
		}
		else
		{
			return currencyReturn;
		}
	}
	else
	{
		return currencyFormat + ' ' + currencyCode;
	}
}


function IsCurrencySymbolBeforeValue( currencyCode )
{
	return g_rgCurrencyData[currencyCode] && g_rgCurrencyData[currencyCode].bSymbolIsPrefix;
}

function IsCurrencyWholeUnits( currencyCode )
{
		return g_rgCurrencyData[currencyCode] && g_rgCurrencyData[currencyCode].bWholeUnitsOnly && currencyCode != 'RUB';
}

// Return the symbol to use for a currency
function GetCurrencySymbol( currencyCode )
{
	return g_rgCurrencyData[currencyCode] ? g_rgCurrencyData[currencyCode].strSymbol : currencyCode + ' ';
}

function GetCurrencyCode( currencyId )
{
	for ( var code in g_rgCurrencyData )
	{
		if ( g_rgCurrencyData[code].eCurrencyCode == currencyId )
			return code;
	}
	return 'Unknown';
}

function GetAvatarURLFromHash( hash, size )
{
	var strURL = 'http://cdn.edgecast.steamstatic.com/steamcommunity/public/images/avatars/' + hash.substring( 0, 2 ) + '/' + hash;

	if ( size == 'full' )
		strURL += '_full.jpg';
	else if ( size == 'medium' )
		strURL += '_medium.jpg';
	else
		strURL += '.jpg';

	return strURL;
}






// need to hold on to this so it doesn't get lost when we remove() the dialog element
var g_AbuseModalContents = null;
function ShowAbuseDialog()
{
	if ( !g_AbuseModalContents )
		g_AbuseModalContents = $J('#reportAbuseModalContents');

	if ( g_AbuseModalContents )
	{
		var Modal = ShowDialog( 'Report Violation', g_AbuseModalContents );
	}
}

function StandardCommunityBan( steamid, elemLink )
{
	$J.get( 'http://steamcommunity.com/actions/communitybandialog', { 'sessionID' : g_sessionID, 'steamID' : steamid } )
	.done( function( data )
	{
		var $Content = $J(data);
		var Modal = ShowConfirmDialog( "Community Ban", $Content, 'Submit'
		).done(	function( ) {

			var $Form = $Content.find( 'form#community_ban_form' );

			$J.post( "http://steamcommunity.com/actions/StandardCommunityBan", $Form.serialize() )
			.done( function( data ) {
				if ( !$J.isEmptyObject( elemLink ) )
				{
                    $J(elemLink).replaceWith( '<span style="color: red;">Banned</span>' );
				}
				else {
                    location.reload();
				}

			}).fail( function( jqxhr ) {
				// jquery doesn't parse json on fail
				var data = V_ParseJSON( jqxhr.responseText );
				ShowAlertDialog( 'Community Ban & Delete Comments', 'Failed with error message: ' + data.success );
			});
		} );

	}).fail( function( data )
	{
		ShowAlertDialog( 'Community Ban & Delete Comments', 'You do not have permissions to view this or you are not logged in.' );
	});

}

function CEmoticonPopup( $EmoticonButton, $Textarea )
{
	this.m_$EmoticonButton = $EmoticonButton;
	this.m_$TextArea = $Textarea;

	if ( CEmoticonPopup.sm_deferEmoticonsLoaded == null )
		CEmoticonPopup.sm_deferEmoticonsLoaded = new jQuery.Deferred();

	this.m_bVisible = false;
	this.m_$Popup = null;

	var _this = this;
	this.m_$EmoticonButton.one('mouseenter', function() { _this.LoadEmoticons(); } );
	this.m_$EmoticonButton.click( function() { _this.LoadEmoticons(); CEmoticonPopup.sm_deferEmoticonsLoaded.done( function() { _this.OnButtonClick(); } ) } );
	this.m_fnOnDocumentClick = function() { _this.DismissPopup(); };
}

CEmoticonPopup.sm_rgEmoticons = [];
CEmoticonPopup.sm_bEmoticonsLoaded = false;
CEmoticonPopup.sm_deferEmoticonsLoaded = null;

CEmoticonPopup.prototype.LoadEmoticons = function()
{
	if ( CEmoticonPopup.sm_bEmoticonsLoaded )
		return;

	CEmoticonPopup.sm_bEmoticonsLoaded = true;
	CEmoticonPopup.sm_rgEmoticons = [];
	$J.get( 'http://steamcommunity.com/actions/EmoticonList' )
		.done( function(data) {
			if ( data )
				CEmoticonPopup.sm_rgEmoticons = data;
		}).always( function() { CEmoticonPopup.sm_deferEmoticonsLoaded.resolve() } );
};

CEmoticonPopup.prototype.OnButtonClick = function()
{
	if ( this.m_bVisible )
	{
		this.DismissPopup();
	}
	else
	{
		if ( !this.m_$Popup )
			this.BuildPopup();
		else
			PositionEmoticonHover( this.m_$Popup, this.m_$EmoticonButton );

		this.m_$EmoticonButton.addClass( 'focus' );
		this.m_$Popup.stop();
		this.m_$Popup.fadeIn( 'fast' );
		this.m_bVisible = true;

		if ( window.UseSmallScreenMode && window.UseSmallScreenMode() )
		{
			// scroll such that the emoticon button is just above the popup window we're showing at the bottom of the screen
			// 	the 10 pixels represents the popup being positioned 5px from the bottom of the screen, and 5px between the popup and button
			$J(window).scrollTop( this.m_$EmoticonButton.offset().top - $J(window).height() + this.m_$Popup.height() + this.m_$EmoticonButton.height() + 10 );
		}

		var _this = this;
		window.setTimeout( function() { $J(document).one( 'click.EmoticonPopup', _this.m_fnOnDocumentClick ) }, 0 );
	}
};

CEmoticonPopup.prototype.DismissPopup = function()
{
	this.m_$Popup.fadeOut( 'fast' );
	this.m_$EmoticonButton.removeClass( 'focus' );
	this.m_bVisible = false;

	$J(document).off( 'click.EmoticonPopup' );
};

CEmoticonPopup.prototype.BuildPopup = function()
{
	this.m_$Popup = $J('<div/>', {'class': 'emoticon_popup_ctn' } );

	var $PopupInner = $J('<div/>', {'class': 'emoticon_popup' } );
	this.m_$Popup.append( $PopupInner );
	var $Content = $J('<div/>', {'class': 'emoticon_popup_content' } );
	$PopupInner.append( $Content );

	for( var i = 0; i < CEmoticonPopup.sm_rgEmoticons.length; i++ )
	{
		var strEmoticonName = CEmoticonPopup.sm_rgEmoticons[i].replace( /:/g, '' );
		var strEmoticonURL = 'http://community.edgecast.steamstatic.com/economy/emoticon/' + strEmoticonName;

		var $Emoticon = $J('<div/>', {'class': 'emoticon_option', 'data-emoticon': strEmoticonName } );
		var $Img = $J('<img/>', {'src': strEmoticonURL, 'class': 'emoticon' } );
		$Emoticon.append( $Img );

		$Emoticon.click( this.GetEmoticonClickClosure( strEmoticonName ) );

		$Content.append( $Emoticon );
	}

	$J(document.body).append( this.m_$Popup );
	PositionEmoticonHover( this.m_$Popup, this.m_$EmoticonButton );
};

CEmoticonPopup.prototype.GetEmoticonClickClosure = function ( strEmoticonName )
{
	var _this = this;
	var strTextToInsert = ':' + strEmoticonName + ':';
	return function() {
		var elTextArea = _this.m_$TextArea[0];
		if ( elTextArea )
		{
			var nSelectionStart = elTextArea.selectionStart;
			elTextArea.value = elTextArea.value.substr( 0, nSelectionStart ) + strTextToInsert + elTextArea.value.substr( nSelectionStart );
			elTextArea.selectionStart = nSelectionStart + strTextToInsert.length;
		}

		_this.m_$TextArea.focus();

		_this.DismissPopup();

		if ( window.DismissEmoticonHover )
			window.setTimeout( DismissEmoticonHover, 1 );
	};
};

function PositionEmoticonHover( $Hover, $Target )
{
	// we position fixed in CSS for responsive mode
	if ( window.UseSmallScreenMode && window.UseSmallScreenMode() )
	{
		$Hover.css( 'left', '' ).css('top', '' );
		return;
	}

		$Hover.css( 'visibility', 'hidden' );
	$Hover.show();

	var offset = $Target.offset();
	$Hover.css( 'left', offset.left + 'px' );
	$Hover.css( 'top', offset.top + 'px');

	var $HoverBox = $Hover.children( '.emoticon_popup' );
	var $HoverArrowLeft = $Hover.children( '.miniprofile_arrow_left' );
	var $HoverArrowRight = $Hover.children( '.miniprofile_arrow_right' );

	var nWindowScrollTop = $J(window).scrollTop();
	var nWindowScrollLeft = $J(window).scrollLeft();
	var nViewportWidth = $J(window).width();
	var nViewportHeight = $J(window).height();

		var $HoverArrow = $HoverArrowRight;
	var nBoxRightViewport = ( offset.left - nWindowScrollLeft ) + $Target.outerWidth() + $HoverBox.width();
	var nSpaceRight = nViewportWidth - nBoxRightViewport;
	var nSpaceLeft = offset.left - $Hover.width();
	if ( nSpaceLeft > 0 || nSpaceLeft > nSpaceRight)
	{
				$Hover.css( 'left', ( offset.left - $Hover.width() - 12) + 'px' );
		$HoverArrowLeft.hide();
		$HoverArrowRight.show();
	}
	else
	{
				$Hover.css( 'left', ( offset.left + $Target.outerWidth() ) + 'px' );
		$HoverArrow = $HoverArrowLeft;
		$HoverArrowLeft.show();
		$HoverArrowRight.hide();
	}

	var nTopAdjustment = 0;

			if ( $Target.height() < 48 )
		nTopAdjustment = Math.floor( $Target.height() / 2 ) - 12;
	var nDesiredHoverTop = offset.top - 0 + nTopAdjustment;
	$Hover.css( 'top', nDesiredHoverTop + 'px' );

	// see if the hover is cut off by the bottom of the window, and bump it up if neccessary
	var nTargetTopViewport = ( offset.top - nWindowScrollTop ) + nTopAdjustment;
	if ( nTargetTopViewport + $HoverBox.height() + 35 > nViewportHeight )
	{
		var nViewportAdjustment = ( $HoverBox.height() + 35 ) - ( nViewportHeight - nTargetTopViewport );

		var nViewportAdjustedHoverTop = offset.top - nViewportAdjustment;
		$Hover.css( 'top', nViewportAdjustedHoverTop + 'px' );

		// arrow is normally offset 30pixels.  we move it down the same distance we moved the hover up, so it is "fixed" to where it was initially
		$HoverArrow.css( 'top', ( 30 + nDesiredHoverTop - nViewportAdjustedHoverTop ) + 'px' );
	}
	else
	{
		$HoverArrow.css( 'top', '' );
	}

	$Hover.hide();
	$Hover.css( 'visibility', '' );
}


function InitEconomyHovers( strEconomyCSSURL, strEconomyCommonJSURL, strEconomyJSURL )
{
	var $Hover = $J('<div/>', {'class': 'economyitem_hover'} );
	var $HoverContent = $J('<div/>', {'class': 'economyitem_hover_content'} );
	$Hover.append( $HoverContent );
	$Hover.hide();

	var fnOneTimeEconomySetup = function() {
		$J(document.body).append( $Hover );

		if ( typeof UserYou == 'undefined' )
		{
						var css = document.createElement( "link" );
			css.setAttribute( "rel", "stylesheet" );
			css.setAttribute( "type", "text/css" );
			css.setAttribute( "href", strEconomyCSSURL );
			var js1 = document.createElement( "script" );
			js1.setAttribute( "type", "text/javascript" );
			js1.setAttribute( "src", strEconomyCommonJSURL );
			var js2 = document.createElement( "script" );
			js2.setAttribute( "type", "text/javascript" );
			js2.setAttribute( "src", strEconomyJSURL );
			var head = $J('head')[0];
			head.appendChild( css );
			head.appendChild( js1 );
			head.appendChild( js2 );
		}
	};

	var fnDataFactory = function( key ) {
		var rgItemKey = key.split('/');
		if ( rgItemKey.length >= 3 && rgItemKey.length <= 5 )
		{
			if ( fnOneTimeEconomySetup )
			{
				fnOneTimeEconomySetup();
				fnOneTimeEconomySetup = null;
			}

			// pop amount off the end first if it's present
			var nAmount;
			var strLastEntry = rgItemKey[rgItemKey.length - 1];
			if ( strLastEntry && strLastEntry.length > 2 && strLastEntry.substr( 0, 2 ) == 'a:' )
			{
				nAmount = strLastEntry.substr( 2 );
				rgItemKey.pop();
			}

			var strURL = null;
			var appid = rgItemKey[0];
			if ( appid == 'classinfo' )
			{
				// class info style
				appid = rgItemKey[1];
				var classid = rgItemKey[2];
				var instanceid = ( rgItemKey.length > 3 ? rgItemKey[3] : 0 );
				strURL = 'economy/itemclasshover/' + appid + '/' + classid + '/' + instanceid;
				strURL += '?content_only=1&l=english';
			}
			else
			{
				// real asset
				var contextid = rgItemKey[1];
				var assetid = rgItemKey[2];
				var strURL = 'economy/itemhover/' + appid + '/' + contextid + '/' + assetid;
				strURL += '?content_only=1&omit_owner=1&l=english';
				if ( rgItemKey.length == 4 && rgItemKey[3] )
				{
					var strOwner = rgItemKey[3];
					if ( strOwner.indexOf( 'id:' ) == 0 )
						strURL += '&o_url=' + strOwner.substr( 3 );
					else
						strURL += '&o=' + strOwner;
				}
			}
			if ( nAmount && nAmount > 1 )
				strURL += '&amount=' + nAmount;
			return new CDelayedAJAXData( strURL, 100 );
		}
		else
			return null;
	};

	var rgCallbacks = BindAJAXHovers( $Hover, $HoverContent, {
		fnDataFactory: fnDataFactory,
		strDataName: 'economy-item',
		strURLMatch: 'itemhover'
	} );
}

function ShowTradeOffer( tradeOfferID, rgParams )
{
	var strParams = '';
	if ( rgParams )
		strParams = '?' + $J.param( rgParams );

	var strKey = ( tradeOfferID == 'new' ? 'NewTradeOffer' + rgParams['partner'] : 'TradeOffer' + tradeOfferID );

	var winHeight = 1120;
	if ( Steam.BIsUserInSteamClient() && Steam.GetClientPackageVersion() < 1407800248 )
	{
		// workaround for client break when the popup window is too tall for the screen.  Try and pick a height that will fit here.
		var nClientChromePX = 92;
		if ( window.screen.availHeight && window.screen.availHeight - nClientChromePX < winHeight )
			winHeight = window.screen.availHeight - nClientChromePX;
	}

	var winOffer = window.open( 'https://steamcommunity.com/tradeoffer/' + tradeOfferID + '/' + strParams, strKey, 'height=' + winHeight + ',width=1028,resize=yes,scrollbars=yes' );

	winOffer.focus();
}

function Logout()
{
	PostToURLWithSession( 'https://steamcommunity.com/login/logout/' );
}

function ChangeLanguage( strTargetLanguage, bStayOnPage )
{
	var Modal = ShowBlockingWaitDialog( 'Change language', '' );
	$J.post( 'http://steamcommunity.com/actions/SetLanguage/', {language: strTargetLanguage, sessionid: g_sessionID })
		.done( function() {
			if ( bStayOnPage )
				Modal.Dismiss();
			else
			{
								if( g_steamID )
					window.location = 'http://store.steampowered.com/account/languagepreferences/';
				else if ( window.location.href.match( /[?&]l=/ ) )
					window.location = window.location.href.replace( /([?&])l=[^&]*&?/, '$1' );
				else
					window.location.reload();
			}
		}).fail( function() {
			Modal.Dismiss();
			ShowAlertDialog( 'Change language', 'There was a problem communicating with the Steam servers.  Please try again later.' );
		});
}





function abuseSSDescripCheck()
{
	var chkd_inap = $('abuseType1').checked;
	var chkd_cprt = $('abuseType5').checked;
	if ( chkd_inap )
	{
		$('abuseDescriptionLabel').setStyle( { color: '#777777', fontStyle: 'italic' } );
		$('abuseDescriptionArea').disable();
		$('abuseDescriptionArea').clear();
	}
	else if ( chkd_cprt )
	{
		$('abuseDescriptionLabel').setStyle( { color: '#898989', fontStyle: 'normal' } );
		$('abuseDescriptionArea').enable();
		$('abuseDescriptionArea').focus();
	}
}






function BindOnHashChange( fnCallback )
{
	if ( 'onhashchange' in window )
	{
		Event.observe( window, 'hashchange', function(e) { fnCallback( this.location.hash ); } );
	}
	else
	{
		new LocationHashObserver( null, 0.1, function( el, hash ) { fnCallback( hash ); } );
	}
}

LocationHashObserver = Class.create(Abstract.TimedObserver, {
	getValue: function() {
		return window.location.hash;
	}
} );


var CAutoSizingTextArea = Class.create( {
	m_elTextArea: null,
	m_nMinHeight: 20,
	m_nMaxHeight: 500,
	m_cCurrentSize: Number.MAX_VALUE,
	m_fnChangeCallback: null,
	m_nTextAreaPadding: null,

	initialize: function( elTextArea, nMinHeight, fnChangeCallback )
	{
		this.m_elTextArea = elTextArea;
		var _this = this;
		$J(this.m_elTextArea ).on( 'keyup blur click paste cut', function( e ) {
			if ( e.type == 'paste' || e.type == 'blur' )
				_this.OnPasteText();
			else
				_this.OnTextInput();
		});
		this.m_elTextArea.style.overflow = 'hidden';

		this.m_cEntryLength = Number.MAX_VALUE;
		this.m_nMinHeight = nMinHeight || 20;
		this.m_fnChangeCallback = fnChangeCallback || null;

		this.m_elTextArea.style.height = this.m_nMinHeight + 'px';

		this.OnTextInput();
	},

	CalculatePadding: function()
	{
		// briefly empty the text area and set the height so we can see how much padding there is
		var strContents = this.m_elTextArea.value;
		this.m_elTextArea.value = '';
		this.m_elTextArea.style.height = this.m_nMinHeight + 'px';
		this.m_nTextAreaPadding = this.m_elTextArea.scrollHeight - this.m_nMinHeight;
		this.m_elTextArea.value = strContents;
	},

	OnPasteText: function()
	{
		this.OnTextInput.bind( this ).defer();
	},

	OnTextInput: function()
	{
		var iScrollOffset = undefined;
		var cNewLength = this.m_elTextArea.value.length;

		// we delay this until first input as some values get reported incorrectly if the element isn't visible.
		if ( this.m_nTextAreaPadding === null && $J(this.m_elTextArea ).is(':visible') )
			this.CalculatePadding();

		// force a resize
		if ( cNewLength < this.m_cEntryLength )
		{
			// when we shrink this box, we might scroll the window.  Remember where we are so we can jump back
			iScrollOffset = window.scrollY;
			this.m_elTextArea.style.height = this.m_nMinHeight + 'px';
		}

		if ( this.m_elTextArea.scrollHeight > this.m_nMaxHeight )
		{
			this.m_elTextArea.style.height = this.m_nMaxHeight + 'px';
			this.m_elTextArea.style.overflow = 'auto';
		}
		else if ( this.m_elTextArea.scrollHeight != this.m_elTextArea.getHeight() )
		{
			var nHeight = Math.max( this.m_elTextArea.scrollHeight, this.m_nMinHeight );
			this.m_elTextArea.style.height = ( nHeight - this.m_nTextAreaPadding ) + 'px';

			if ( this.m_elTextArea.style.overflow == 'auto' )
				this.m_elTextArea.style.overflow = 'hidden';
		}

		if ( this.m_fnChangeCallback )
			this.m_fnChangeCallback( this.m_elTextArea );

		if ( iScrollOffset )
			window.scrollTo( window.scrollX, iScrollOffset );

		this.m_cEntryLength = cNewLength;
	}
});





function UpdateParameterInCurrentURL( strParamName, strParamValue, rgRemoveParameters )
{
	var path = window.location.pathname;
	var query = window.location.search;
	var params = {};
	if ( query && query.length > 2 )
		params = $J.deparam( query.substr( 1 ) );

	if ( strParamValue === null )
		delete params[strParamName];
	else
		params[strParamName] = strParamValue;

	// comment thread specific
	if ( rgRemoveParameters )
		for( var i = 0; i < rgRemoveParameters.length; i++ )
			delete params[ rgRemoveParameters[i] ];

	query = $J.param( params );

	return path + ( query ? '?' + query : '' );
}


var g_rgCommentThreads = {};
function InitializeCommentThread( type, name, rgCommentData, url, nQuoteBoxHeight )
{
	// see if we have a custom comment thread class for this type
	var commentclass = CCommentThread;
	if ( window['CCommentThread' + type] )
		commentclass = window['CCommentThread' + type];

	g_rgCommentThreads[name] = new commentclass( type, name, rgCommentData, url, nQuoteBoxHeight );
}

function BindCommentThreadSubscribeButtons( type, owner, gidfeature, gidfeature2, btnSubscribe, btnUnsubscribe )
{
	var CommentThread = FindCommentThread( type, owner, gidfeature, gidfeature2 );
	if ( CommentThread )
		CommentThread.BindSubscribeButtons( btnSubscribe, btnUnsubscribe );
}

function FindCommentThread( type, owner, gidFeature, gidFeature2 )
{
	for ( var key in g_rgCommentThreads )
	{
		if ( g_rgCommentThreads[key].BMatches( type, owner, gidFeature, gidFeature2 ) )
			return g_rgCommentThreads[key];
	}
	return null;
}

var CCommentThread = Class.create( {

	m_strName: null,
	m_strCommentThreadType: null,
	m_rgCommentData: null,
	m_strActionURL: null,
	m_elTextArea: null,
	m_cPageSize: null,
	m_nQuoteBoxHeight: 40,

	m_cTotalCount: 0,
	m_iCurrentPage: 0,
	m_cMaxPages: 0,
	m_cDropdownPages: 0,
	m_bLoading: false,
	m_bLoadingUserHasUpVoted : false,
	m_cUpVotes: 0,

	m_bIncludeRaw: false,
	m_rgRawCommentCache: null,
	m_bHasPaging: true,
	m_bTrackNavigation: false,	// should we track navigation in the URL?

	// these vars are id's we'll update when values change
	m_votecountID: null,
	m_voteupID: null,
	m_commentcountID: null,

	m_oTextAreaSizer: null,

	m_bSubscribed: null,
	m_$SubscribeCheckbox: null,

	initialize: function( type, name, rgCommentData, url, nQuoteBoxHeight )
	{
		this.m_strName = name;
		this.m_strCommentThreadType = type;
		this.m_rgCommentData = rgCommentData;
		this.m_strActionURL = url;
		this.m_nQuoteBoxHeight = nQuoteBoxHeight;

		var start = rgCommentData['start'] ? rgCommentData['start'] : 0;

		this.m_cTotalCount = rgCommentData['total_count'];
		this.m_cPageSize = rgCommentData['pagesize'];
		this.m_iCurrentPage = Math.floor( start / this.m_cPageSize );
		this.m_cMaxPages = Math.ceil( this.m_cTotalCount / this.m_cPageSize );
		this.m_bLoadingUserHasUpVoted = rgCommentData['has_upvoted'];
		this.m_cUpVotes = rgCommentData['upvotes'];
		this.m_votecountID = rgCommentData['votecountid'];
		this.m_voteupID = rgCommentData['voteupid'];
		this.m_commentcountID = rgCommentData['commentcountid'];

		this.m_bSubscribed = rgCommentData['subscribed'];

		this.m_bHasPaging = !rgCommentData['no_paging'];
		this.m_bTrackNavigation = !!rgCommentData['track_navigation'];


		var strPrefix = 'commentthread_' + this.m_strName;
		this.m_elTextArea = $( strPrefix + '_textarea');

		if ( rgCommentData['comments_raw'] )
		{
			this.m_bIncludeRaw = true;
			this.m_rgRawCommentCache = rgCommentData['comments_raw'];
			rgCommentData['comments_raw'] = undefined;
		}

		if ( this.m_elTextArea )
		{
			var elSaveButton = $('commentthread_' + this.m_strName + '_submit_container');
			var iMinHeight = this.m_nQuoteBoxHeight;
			if ( this.m_strName.startsWith( 'Profile_' ) )
				iMinHeight = 20;

			this.m_oTextAreaSizer = new CAutoSizingTextArea( this.m_elTextArea, iMinHeight, this.OnTextInput.bind( this, elSaveButton ) );
		}

		var _this = this;

		if ( this.m_bHasPaging )
		{
			$(strPrefix + '_pagebtn_prev').observe( 'click', this.OnPagingButtonClick.bindAsEventListener( this , this.PrevPage )  );
			$(strPrefix + '_fpagebtn_prev').observe( 'click', this.OnPagingButtonClick.bindAsEventListener( this , this.PrevPage )  );
			$(strPrefix + '_pagebtn_next').observe( 'click', this.OnPagingButtonClick.bindAsEventListener( this , this.NextPage ) );
			$(strPrefix + '_fpagebtn_next').observe( 'click', this.OnPagingButtonClick.bindAsEventListener( this , this.NextPage ) );

			if ( this.m_bTrackNavigation && window.history && window.history.pushState )
			{
				window.history.replaceState( {comment_thread_page: this.m_iCurrentPage }, '' );

				$J(window).on('popstate', function( e ) {
					var oState = e.originalEvent.state;

					if ( oState && typeof oState.comment_thread_page != 'undefined' )
						_this.GoToPage( oState.comment_thread_page );
				});
			}
		}

		var elForm = $( strPrefix + '_form');
		if ( elForm )
		{
			elForm.observe( 'submit', this.OnSubmit.bind( this ) );
		}

		var elSubmit = $(strPrefix + '_submit');
		if ( elSubmit )
		{
			elSubmit.observe( 'click', this.OnSubmit.bind( this ) );
		}

		var elAutosubscribe = $(strPrefix + '_autosubscribe' );
		if ( elAutosubscribe )
		{
			// initialize check state based on preferences
			elAutosubscribe.checked = this.m_bSubscribed || GetValueLocalStorage( 'forum_autosubscribe', false );
			elAutosubscribe.observe( 'change', this.OnAutosubscribeToggle.bind( this ) );
		}

		var elSubscribe = $(strPrefix + '_subscribe');
		var elUnsubscribe = $(strPrefix + '_unsubscribe' );
		if ( elSubscribe && elUnsubscribe )
		{
			this.BindSubscribeButtons( elSubscribe, elUnsubscribe );
		}

		this.m_$SubscribeCheckbox = $J('#' + strPrefix + '_subscribe_checkbox');
		this.m_$SubscribeCheckbox.click( function() {
			if ( _this.m_$SubscribeCheckbox.hasClass( 'waiting' ) )
				return;

			if ( _this.m_bSubscribed )
				_this.Unsubscribe( function() {},  function() {ShowAlertDialog('Subscribe to thread', 'There was a problem updating your subscription.  Please try again later.');});
			else
				_this.Subscribe( function() {},  function() {ShowAlertDialog('Subscribe to thread', 'There was a problem updating your subscription.  Please try again later.');});
		});

		this.UpdatePagingDisplay();
	},

	BMatches: function( strType, steamidOwner, gidFeature, gidFeature2 )
	{
		return this.m_strCommentThreadType == strType && this.m_rgCommentData['owner'] == steamidOwner &&
			this.m_rgCommentData['feature'] == gidFeature && this.m_rgCommentData['feature2'] == gidFeature2;
	},

	CheckTextAreaSize: function()
	{
		this.m_oTextAreaSizer.OnTextInput();
	},

	OnTextInput: function( elSaveButton, elTextArea )
	{
		if ( elSaveButton )
		{
			var strPrepoulatedText = $J(this.m_elTextArea ).data('prepopulated-text');
			var bEnteredText = elTextArea.value.length > 0;

			if ( bEnteredText && strPrepoulatedText && !$J(this.m_elTextArea ).data('replaced-prepopulated-text') )
			{
				strPrepoulatedText = v_trim( strPrepoulatedText ).replace( /[\n\r]/g, '' );
				var strEnteredText = v_trim( elTextArea.value ).replace( /[\n\r]/g, '' );

				bEnteredText = strPrepoulatedText != strEnteredText;

				// save so we don't have to keep doing this check as they enter more text.
				if ( bEnteredText )
					$J(this.m_elTextArea ).data('replaced-prepopulated-text', true );
			}

			if ( bEnteredText )
				elSaveButton.show();
			else
				elSaveButton.hide();
		}
	},

	GetActionURL: function( action )
	{
		var url = this.m_strActionURL + action + '/';
		url += this.m_rgCommentData['owner'] + '/';
		url += this.m_rgCommentData['feature'] + '/';
		return url;
	},

	ParametersWithDefaults: function( params )
	{
		if ( !params )
			params = {};

		params['count'] = this.m_cPageSize;
		params['sessionid'] = g_sessionID;

		if ( this.m_rgCommentData['extended_data'] )
			params['extended_data'] = this.m_rgCommentData['extended_data'];

		if ( this.m_rgCommentData['feature2'] )
			params['feature2'] = this.m_rgCommentData['feature2'];

		if ( this.m_rgCommentData['oldestfirst'] )
			params['oldestfirst'] = true;

		if ( this.m_rgCommentData['newestfirstpagination'] )
			params['newestfirstpagination'] = true;

		if ( this.m_rgCommentData['lastvisit'] )
			params['lastvisit'] = this.m_rgCommentData['lastvisit'];

		if ( this.m_bIncludeRaw )
			params['include_raw'] = true;


		return params;
	},

	OnSubmit: function()
	{
		if ( this.m_bLoading )
			return;

		var strPrepoulatedText = $J(this.m_elTextArea ).data('prepopulated-text');
		if ( strPrepoulatedText && v_trim( strPrepoulatedText ).replace( /[\n\r]/g, '' ) == v_trim( this.m_elTextArea.value ).replace( /[\n\r]/g, '' ) )
		{
			ShowAlertDialog( '', 'Please enter a comment to post.' );
			return;
		}

		var params = this.ParametersWithDefaults( {
			comment: this.m_elTextArea.value
		} );
		
		this.m_bLoading = true;
		new Ajax.Request( this.GetActionURL( 'post' ), {
			method: 'post',
			parameters: params,
			onSuccess: this.OnResponseAddComment.bind( this, ++this.m_nRenderAjaxSequenceNumber ),
			onFailure: this.OnFailureDisplayError.bind( this ),
			onComplete: this.OnAJAXComplete.bind( this )
		} );

		var elAutosubscribe = $( 'commentthread_' + this.m_strName + '_autosubscribe' );
		if ( elAutosubscribe && elAutosubscribe.checked && !this.m_bSubscribed )
			this.Subscribe();

		return false;
	},

	DeleteComment: function( gidComment, bUndelete, fnOnSuccess )
	{
		if ( this.m_bLoading )
			return;

		var params = this.ParametersWithDefaults( {
			gidcomment: gidComment,
			start: this.m_cPageSize * this.m_iCurrentPage
		} );

		if ( bUndelete )
			params.undelete = 1;

		this.m_bLoading = true;
		new Ajax.Request( this.GetActionURL( 'delete' ), {
			method: 'post',
			parameters: params,
			onSuccess: fnOnSuccess ? fnOnSuccess : this.OnResponseDeleteComment.bind( this, ++this.m_nRenderAjaxSequenceNumber ),
			onFailure: this.OnFailureDisplayError.bind( this ),
			onComplete: this.OnAJAXComplete.bind( this )
		} );
	},

	DisplayEditComment: function( gidComment )
	{
		var elForm = $('editcommentform_' + gidComment);
		var elTextarea = $('comment_edit_text_' + gidComment);

		var elContent = $('comment_content_' + gidComment);
		elContent.hide();

		if ( elContent.next('.forum_audit') )
			elContent.next('.forum_audit').hide();

		$('comment_edit_' + gidComment).show();
		$('comment_edit_' + gidComment + '_error').update('');

		if ( !elTextarea.value || elTextarea.value.length == 0 )
			elTextarea.value = this.m_rgRawCommentCache[ gidComment ].text;

		if ( !elForm.m_bEventsBound )
		{
			new CAutoSizingTextArea( elTextarea, 40 );
			elForm.observe( 'submit', this.SubmitEditComment.bind( this, elForm ) );
			elForm.observe( 'reset', this.HideEditComment.bind( this, gidComment ) );
			elForm.m_bEventsBound = true;
		}
	},

	VoteUp: function()
	{
		if ( this.m_bLoading )
			return;

		var params = this.ParametersWithDefaults( {
			vote: this.m_bLoadingUserHasUpVoted ? 0 : 1	// flip our vote
		} );

		this.m_bLoading = true;
		new Ajax.Request( this.GetActionURL( 'voteup' ), {
			method: 'post',
			parameters: params,
			onSuccess: this.OnResponseVoteUp.bind( this, ++this.m_nRenderAjaxSequenceNumber ),
			onFailure: this.OnFailureDisplayError.bind( this ),
			onComplete: this.OnAJAXComplete.bind( this )
		} );
	},

	UpdateAnswer: function( gidComment, bExisting )
	{
		// see if it's on the current page
		if ( this.m_bLoading )
			return;

		if ( !gidComment )
		{
			$modal = ShowConfirmDialog( 'Remove As Answer', 'Are you sure you want to unmark this post as the answer to this thread? You can update this at any time.', 'Remove As Answer' );
		}
		else
		{
			var strModalBody = 'You are about to mark this post as the answer to this thread. This will indicate that the original post has been answered and link to this specific post. You can remove this or indicate a different post as the answer at any time if you change your mind.';
			if ( bExisting )
				strModalBody = 'A different post is already selected as the answer to this thread. Would you like to choose this post as the new answer?';

			$modal = ShowConfirmDialog( 'Mark As Answer', strModalBody, 'Choose Answer' );
			$modal.SetMaxWidth(500);
		}

		var _$this = this;

		$modal.done( function(){

			var params = _$this.ParametersWithDefaults( {
				gidcommentanswer: gidComment
			} );

			_$this.m_bLoading = true;
			new Ajax.Request( _$this.GetActionURL( 'updateanswer' ), {
				method: 'post',
				parameters: params,
				onSuccess: function() {
										window.location.hash = 'c' + gidComment;
					window.location.reload();
				},
				onFailure: function( transport ) {
					if ( transport.responseJSON && transport.responseJSON.success )
					{
						var strError = 'There was an issue updating this topic answer. Error: ' + transport.responseJSON.success;
						if ( transport.responseJSON.success == 15 )
						{
							strError = 'You do not have permission to update this topic\'s answer.'
						}

						ShowAlertDialog( 'Error', strError );
					}
				},
				onComplete: _$this.OnAJAXComplete.bind( _$this )
			});
		} );

	},

	GetRawComment: function( gidComment )
	{
		return this.m_rgRawCommentCache[ gidComment ];
	},

	GetCommentTextEntryElement: function()
	{
		return this.m_elTextArea;
	},

	HideEditComment: function( gidComment )
	{
		$('comment_content_' + gidComment).show();
		$('comment_edit_' + gidComment).hide();
	},

	OnResponseEditComment: function( gidComment, nAjaxSequenceNumber, transport )
	{
		if ( transport.responseJSON && transport.responseJSON.success)
		{
			// no need to hide because render will replace our whole element
			this.OnResponseRenderComments( CCommentThread.RENDER_DELETEDPOST, nAjaxSequenceNumber, transport );	//display the updated comment thread
		}
		else
		{
			this.OnEditFailureDisplayError( gidComment, transport );
		}
	},

	OnEditFailureDisplayError: function( gidComment, transport )
	{
		this.DisplayError( $('comment_edit_' + gidComment + '_error'), transport );
	},

	SubmitEditComment: function( elForm )
	{
		if ( this.m_bLoading )
			return false;

		var gidComment = elForm.elements['gidcomment'].value;
		var strComment = elForm.elements['comment'].value;

		var params = this.ParametersWithDefaults( {
			gidcomment: gidComment,
			comment: strComment,
			start: this.m_cPageSize * this.m_iCurrentPage
		} );

		this.m_bLoading = true;
		new Ajax.Request( this.GetActionURL( 'edit' ), {
			method: 'post',
			parameters: params,
			onSuccess: this.OnResponseEditComment.bind( this, gidComment, ++this.m_nRenderAjaxSequenceNumber ),
			onFailure: this.OnEditFailureDisplayError.bind( this, gidComment ),
			onComplete: this.OnAJAXComplete.bind( this )
		} );
		return false;
	},

	OnAJAXComplete: function()
	{
		this.m_bLoading = false;
	},

	OnPagingButtonClick: function( event, fnToExecute )
	{
		event.stop();
		fnToExecute.call( this );
	},

	NextPage: function()
	{
		if ( this.m_iCurrentPage < this.m_cMaxPages - 1 )
			this.GoToPage( this.m_iCurrentPage + 1 );
	},

	PrevPage: function()
	{
		if ( this.m_iCurrentPage > 0 )
			this.GoToPage( this.m_iCurrentPage - 1 );
	},

	m_nRenderAjaxSequenceNumber: 0,
	GoToPage: function( iPage, eRenderReason )
	{
		if (  iPage >= this.m_cMaxPages || iPage < 0 || ( iPage == this.m_iCurrentPage && !this.m_bLoading ) )
			return;

		var params = this.ParametersWithDefaults( {
			start: this.m_cPageSize * iPage,
			totalcount: this.m_cTotalCount
		} );

		this.m_bLoading = true;
		new Ajax.Request( this.GetActionURL( 'render' ), {
			method: 'post',
			parameters: params,
			onSuccess: this.OnResponseRenderComments.bind( this, eRenderReason || CCommentThread.RENDER_GOTOPAGE, ++this.m_nRenderAjaxSequenceNumber ),
			onComplete: this.OnAJAXComplete.bind( this )
		});
	},

	GoToPageWithComment: function( gidComment, eRenderReason )
	{
		// see if it's on the current page
		if ( this.m_bLoading || $('comment_' + gidComment ) )
			return;

		// nope, load
		var params = this.ParametersWithDefaults( {
			gidComment: gidComment
		} );

		new Ajax.Request( this.GetActionURL( 'render' ), {
			method: 'post',
			parameters: params,
			onSuccess: this.OnResponseRenderComments.bind( this, eRenderReason || CCommentThread.RENDER_GOTOCOMMENT, ++this.m_nRenderAjaxSequenceNumber ),
			onComplete: this.OnAJAXComplete.bind( this )
		});
	},

	OnResponseAddComment: function( nAjaxSequenceNumber, transport )
	{
		if ( transport.responseJSON && transport.responseJSON.success)
		{
			$('commentthread_' + this.m_strName + '_entry_error').hide();
			this.m_elTextArea.value='';
			this.CheckTextAreaSize();
			this.OnResponseRenderComments( CCommentThread.RENDER_NEWPOST, nAjaxSequenceNumber, transport );	//display the updated comment thread

			if ( $('commentthread_' + this.m_strName + '_subscribeoptions') )
				$('commentthread_' + this.m_strName + '_subscribeoptions').show();
		}
		else
		{
			this.OnFailureDisplayError( transport );
		}
	},

	OnResponseDeleteComment: function( nAjaxSequenceNumber, transport )
	{
		if ( transport.responseJSON && transport.responseJSON.success )
			this.OnResponseRenderComments( CCommentThread.RENDER_DELETEDPOST, nAjaxSequenceNumber, transport );
		else
			this.OnFailureDisplayError( transport );
	},

	OnResponseVoteUp: function( nAjaxSequenceNumber, transport )
	{
		if ( transport.responseJSON && transport.responseJSON.success )
		{
			this.OnResponseRenderComments( CCommentThread.RENDER_GOTOCOMMENT, nAjaxSequenceNumber, transport );
			this.m_bLoadingUserHasUpVoted = !this.m_bLoadingUserHasUpVoted;	// we can switch this to getting from the response after 8/24/2012
			this.m_cUpVotes = transport.responseJSON.upvotes;

			if ( this.m_votecountID && $(this.m_votecountID) && transport.responseJSON.votetext )
			{
				$(this.m_votecountID).innerHTML = transport.responseJSON.votetext;
			}

			if ( this.m_voteupID && $(this.m_voteupID) )
			{
				if ( this.m_bLoadingUserHasUpVoted )
					$(this.m_voteupID).addClassName('active');
				else
					$(this.m_voteupID).removeClassName('active');
			}
		}
		else
			this.OnFailureDisplayError( transport );
	},

	OnFailureDisplayError: function( transport )
	{
		this.DisplayError( $('commentthread_' + this.m_strName + '_entry_error'), transport );
	},

	DisplayError: function( elError, transport )
	{
		var strMessage = 'Sorry, some kind of error has occurred: ';
		if ( transport.responseJSON && transport.responseJSON.error )
			strMessage += transport.responseJSON.error;
		else
			strMessage += 'There was an error communicating with the network. Please try again later.';

		elError.update( strMessage );
		elError.show();
	},

	OnResponseRenderComments: function( eRenderReason, nAjaxSequenceNumber, transport )
	{
		if ( this.m_nRenderAjaxSequenceNumber != nAjaxSequenceNumber )
			return;

		if ( transport.responseJSON )
		{
			var response = transport.responseJSON;
			this.m_cTotalCount = response.total_count;
			this.m_cMaxPages = Math.ceil( response.total_count / response.pagesize );
			this.m_iCurrentPage = Math.floor( response.start / response.pagesize );

			if ( response.comments_raw )
				this.m_rgRawCommentCache = response.comments_raw;

			if ( this.m_commentcountID && $(this.m_commentcountID) )
				$(this.m_commentcountID).innerHTML = this.m_cTotalCount;

			if ( this.m_cTotalCount <= response.start && this.m_iCurrentPage > 0 )
			{
				// this page is no logner valid, flip back a page (deferred so that the AJAX handler exits and reset m_bLoading)
				this.GoToPage.bind( this, this.m_iCurrentPage - 1 ).defer();
				return;
			}

			if ( this.m_bTrackNavigation && window.history && window.history.pushState )
			{
				var params = window.location.search.length ? $J.deparam( window.location.search.substr(1) ) : {};
				if ( ( !params['ctp'] && this.m_iCurrentPage != 0 ) || ( params['ctp'] && params['ctp'] != this.m_iCurrentPage + 1 ) )
				{
					var fnStateUpdate = window.history.pushState.bind( window.history );
					var url = UpdateParameterInCurrentURL( 'ctp', this.m_iCurrentPage == 0 ? null : this.m_iCurrentPage + 1, ['tscn'] );
					if ( eRenderReason == CCommentThread.RENDER_GOTOPAGE_HASHCHANGE || eRenderReason == CCommentThread.RENDER_GOTOCOMMENT_HASHCHANGE )
					{
						fnStateUpdate = window.history.replaceState.bind( window.history );
						if ( eRenderReason == CCommentThread.RENDER_GOTOCOMMENT_HASHCHANGE )
							url += window.location.hash;
					}
					fnStateUpdate( { comment_thread_page: this.m_iCurrentPage }, '', url );
				}
			}

			this.DoTransitionToNewPosts( response, eRenderReason );

			if ( typeof BindCommunityTooltip != 'undefined' )
				BindCommunityTooltip( $J( $('commentthread_' + this.m_strName + '_posts' ) ).find('[data-community-tooltip]' ) );

			// if we're viewing the most recent page of comments, refresh notifications
			if ( ( !this.m_rgCommentData['oldestfirst'] && this.m_iCurrentPage == 0 ) ||
					this.m_rgCommentData['oldestfirst'] && ( this.m_iCurrentPage + 1 ) * this.m_cPageSize > this.m_cTotalCount )
			{
				RefreshNotificationArea();
			}

			this.UpdatePagingDisplay();
		}
	},

	DoTransitionToNewPosts: function( response, eRenderReason )
	{
		var strNewHTML = response.comments_html;

		var elPosts = $('commentthread_' + this.m_strName + '_posts' );
		var elContainer = $('commentthread_' + this.m_strName + '_postcontainer' );
		elContainer.style.height = elContainer.getHeight() + 'px';
		elContainer.style.overflow = 'hidden';

		var bNewPost = ( eRenderReason == CCommentThread.RENDER_NEWPOST );

		if ( bNewPost && this.m_cTotalCount <= this.m_cPageSize && !this.m_rgCommentData['oldestfirst'] && !this.m_rgCommentData['newestfirstpagination'] )
		{
			elContainer.style.position = 'relative';
			elPosts.style.position = 'absolute';
			elPosts.style.left = '0px';
			elPosts.style.right = '0px';
			elPosts.style.bottom = '0px';
		}
		else
		{
			elPosts.style.position = 'static';
		}

		elPosts.update( strNewHTML );

		ScrollToIfNotInView( $('commentthread_' + this.m_strName + '_area'), 40, 20 );

		if ( elContainer.effect )
			elContainer.effect.cancel();

		( function() {
			elContainer.effect = new Effect.Morph( elContainer, { style: 'height: ' + elPosts.getHeight() + 'px', duration: 0.25, afterFinish: function() { elPosts.style.position = 'static'; elContainer.style.height = 'auto'; elContainer.style.overflow = '';  } } );
		}).defer();
	},

	UpdatePagingDisplay: function()
	{
		if ( !this.m_bHasPaging )
			return;

		var strPrefix = 'commentthread_' + this.m_strName;

		// this element not displayed on the forum topic page
		$(strPrefix + '_totalcount') && $(strPrefix + '_totalcount').update( v_numberformat( this.m_cTotalCount ) );

		var rgPagingControls = [ strPrefix + '_page', strPrefix + '_fpage' ];
		for ( var i = 0; i < rgPagingControls.length; i++ )
		{
			var strPagePrefix = rgPagingControls[i];

			// these elements are displayed on the forum topic page
			$(strPagePrefix + 'total') && $(strPagePrefix + 'total').update( v_numberformat( this.m_cTotalCount ) );
			$(strPagePrefix + 'start') && $(strPagePrefix + 'start').update( v_numberformat( this.m_iCurrentPage * this.m_cPageSize + 1 ) );
			$(strPagePrefix + 'end') && $(strPagePrefix + 'end').update( Math.min( ( this.m_iCurrentPage + 1 ) * this.m_cPageSize, this.m_cTotalCount ) );

			if ( $(strPagePrefix + 'ctn' ) )
			{
				if ( this.m_cTotalCount > 0 )
					$(strPagePrefix + 'ctn' ).show();
				else
					$(strPagePrefix + 'ctn' ).hide();
			}


			if ( this.m_cMaxPages <= 1 )
			{
				$(strPagePrefix + 'controls').hide();
			}
			else
			{
				$(strPagePrefix + 'controls').show();
				if ( this.m_iCurrentPage > 0 )
				{
					$(strPagePrefix + 'btn_prev').removeClassName('disabled');
					if ( this.m_bTrackNavigation )
						$(strPagePrefix + 'btn_prev').href = UpdateParameterInCurrentURL( 'ctp', this.m_iCurrentPage == 1 ? null : this.m_iCurrentPage, ['tscn'] );
				}
				else
				{
					$(strPagePrefix + 'btn_prev').addClassName('disabled');
					if ( this.m_bTrackNavigation )
						$(strPagePrefix + 'btn_prev').href = 'javascript:void(0);';
				}

				if ( this.m_iCurrentPage < this.m_cMaxPages - 1 )
				{
					$(strPagePrefix + 'btn_next').removeClassName('disabled');
					if ( this.m_bTrackNavigation )
						$(strPagePrefix + 'btn_next').href = UpdateParameterInCurrentURL( 'ctp', this.m_iCurrentPage + 2, ['tscn'] );
				}
				else
				{
					$(strPagePrefix + 'btn_next').addClassName('disabled');
					if ( this.m_bTrackNavigation )
						$(strPagePrefix + 'btn_next').href = 'javascript:void(0);';
				}

				var elPageLinks = $(strPagePrefix + 'links');
				elPageLinks.update('');
				// we always show first, last, + 3 page links closest to current page
				var cPageLinksAheadBehind = 2;
				var firstPageLink = Math.max( this.m_iCurrentPage - cPageLinksAheadBehind, 1 );
				var lastPageLink = Math.min( this.m_iCurrentPage + (cPageLinksAheadBehind*2) + ( firstPageLink - this.m_iCurrentPage ), this.m_cMaxPages - 2 );

				if ( lastPageLink - this.m_iCurrentPage < cPageLinksAheadBehind )
					firstPageLink = Math.max( this.m_iCurrentPage - (cPageLinksAheadBehind*2) + ( lastPageLink - this.m_iCurrentPage ), 1 );

				this.AddPageLink( elPageLinks, 0 );
				if ( firstPageLink != 1 )
					elPageLinks.insert( ' ... ' );

				for ( var iPage = firstPageLink; iPage <= lastPageLink; iPage++ )
				{
					this.AddPageLink( elPageLinks, iPage );
				}

				if ( lastPageLink != this.m_cMaxPages - 2 )
					elPageLinks.insert( ' ... ' );
				this.AddPageLink( elPageLinks, this.m_cMaxPages - 1 );
			}

			// update the dropdown list with the total.
			var $DropdownCtn = $J( '#' + strPagePrefix + 'dropdown');
			var $Select = $DropdownCtn.children( 'select' );

			if ( true )
			{
				if ( !$Select.length )
				{
					$Select = $J('<select/>');
					var _this = this;
					$Select.change( function() {
						var $Select = $J(this);
						_this.GoToPage( $Select.val() );
					});
					$DropdownCtn.append( $Select );
				}

				$Select.empty();

				// we always show first, last, + 3 page links closest to current page
				var fnAddPageDropdown = function( iDropdownPage )
				{
					$Select.append( $J('<option/>', { 'value' : iDropdownPage } ).text( iDropdownPage >= 999 ? v_numberformat( iDropdownPage + 1 ) : iDropdownPage + 1) );
				};

				var cPageLinksAheadBehind = 10;
				var firstPageLink = Math.max( this.m_iCurrentPage - cPageLinksAheadBehind, 1 );
				var lastPageLink = Math.min( this.m_iCurrentPage + (cPageLinksAheadBehind*2) + ( firstPageLink - this.m_iCurrentPage ), this.m_cMaxPages - 2 );

				if ( lastPageLink - this.m_iCurrentPage < cPageLinksAheadBehind )
					firstPageLink = Math.max( this.m_iCurrentPage - (cPageLinksAheadBehind*2) + ( lastPageLink - this.m_iCurrentPage ), 1 );

				fnAddPageDropdown( 0 );
				if ( firstPageLink != 1 )
					$Select.append( $J('<option/>', { 'value' : '', 'disabled':1 } ).text('...') );

				for ( var iPage = firstPageLink; iPage <= lastPageLink; iPage++ )
				{
					fnAddPageDropdown( iPage );
				}

				if ( lastPageLink != this.m_cMaxPages - 2 )
					$Select.append( $J('<option/>', { 'value' : '', 'disabled':1 } ).text('...') );
				fnAddPageDropdown( this.m_cMaxPages - 1 );
			}

			$Select.val( this.m_iCurrentPage );
		}

		this.m_cDropdownPages = this.m_cMaxPages;
	},

	AddPageLink: function( elPageLinks, iPage )
	{
		var el;
		if ( this.m_bTrackNavigation )
			el = new Element( 'a', {'class': 'commentthread_pagelink', 'href': UpdateParameterInCurrentURL( 'ctp', iPage + 1, ['tscn'] ) } );
		else
			el = new Element( 'span', {'class': 'commentthread_pagelink' } );

		el.update( (iPage + 1) );

		var fnGoToPage = this.GoToPage.bind( this, iPage );

		if ( iPage == this.m_iCurrentPage )
			el.addClassName( 'active' );
		else
			el.observe( 'click',  function(e) { e.stop(); fnGoToPage(); } );
		
		elPageLinks.insert( el );
		elPageLinks.insert( ' ' );
	},

	Subscribe: function( fnOnSuccess, fnOnFail )
	{
		var params = this.ParametersWithDefaults();
		this.m_$SubscribeCheckbox.addClass('waiting');

		var _this = this;
		$J.post( this.GetActionURL( 'subscribe' ), params )
			.done( function() {
				_this.OnSubscriptionChange( true, fnOnSuccess );
			})
			.fail( fnOnFail )
			.always( function() { _this.m_$SubscribeCheckbox.removeClass('waiting' ) } );
	},

	Unsubscribe: function( fnOnSuccess, fnOnFail )
	{
		var params = this.ParametersWithDefaults();
		this.m_$SubscribeCheckbox.addClass('waiting');

		var _this = this;
		$J.post( this.GetActionURL( 'unsubscribe' ), params )
			.done( function() {
				_this.OnSubscriptionChange( false, fnOnSuccess );
			})
			.fail( fnOnFail )
			.always( function() { _this.m_$SubscribeCheckbox.removeClass('waiting' ) } );
	},

	m_rgSubscriptionUpdateHandlers: null,

	BindSubscribeButtons: function( elBtnSubscribe, elBtnUnsubscribe )
	{
		var _this = this;

		if ( !this.m_rgSubscriptionUpdateHandlers )
			this.m_rgSubscriptionUpdateHandlers = [];

		this.m_rgSubscriptionUpdateHandlers.push( function() {
			if ( _this.m_bSubscribed )
			{
				$J(elBtnSubscribe).hide();
				$J(elBtnUnsubscribe).show();
			}
			else
			{
				$J(elBtnSubscribe).show();
				$J(elBtnUnsubscribe).hide();
			}
		} );

		$J(elBtnSubscribe).click( function() {
			_this.Subscribe( function() {
				ShowAlertDialog('Subscribe to thread', 'You\'ll receive a comment notification whenever someone replies to this thread.');
			}, function() {
				ShowAlertDialog('Subscribe to thread', 'There was a problem updating your subscription.  Please try again later.');
			});
		});

		$J(elBtnUnsubscribe).click( function() {
			_this.Unsubscribe( function() {
				ShowAlertDialog('Unsubscribe from thread', 'You\'ll no longer receive comment notifications from this thread.');
			}, function() {
				ShowAlertDialog('Unsubscribe from thread', 'There was a problem updating your subscription.  Please try again later.');
			});
		});

		this.UpdateSubscriptionDisplay();
	},

	OnSubscriptionChange: function( bSubscribed, fnProxy, transport )
	{
		this.m_bSubscribed = bSubscribed;

		if ( fnProxy )
			fnProxy( transport );

		this.UpdateSubscriptionDisplay();
	},

	UpdateSubscriptionDisplay: function()
	{
		if ( this.m_rgSubscriptionUpdateHandlers && this.m_rgSubscriptionUpdateHandlers.length )
		{
			for ( var i = 0; i < this.m_rgSubscriptionUpdateHandlers.length; i++ )
				(this.m_rgSubscriptionUpdateHandlers[i])();
		}

		if ( this.m_bSubscribed )
			this.m_$SubscribeCheckbox.addClass('checked');
		else
			this.m_$SubscribeCheckbox.removeClass('checked');

		var elForumSubscribe = $('forum_subscribe_' + this.m_rgCommentData['feature2'] );
		var elForumUnsubscribe = $('forum_unsubscribe_' + this.m_rgCommentData['feature2'] );
		if ( elForumSubscribe && elForumUnsubscribe )
		{
			if ( this.m_bSubscribed )
			{
				elForumSubscribe.hide();
				elForumUnsubscribe.show();
			}
			else
			{
				elForumSubscribe.show();
				elForumUnsubscribe.hide();
			}
		}
	},

	OnAutosubscribeToggle: function()
	{
		var elAutosubscribe = $( 'commentthread_' + this.m_strName + '_autosubscribe' );
		if ( elAutosubscribe )
		{
			if ( elAutosubscribe.checked )
				SetValueLocalStorage( 'forum_autosubscribe', true );
			else
				UnsetValueLocalStorage( 'forum_autosubscribe' );
		}
	}

} );
CCommentThread.RENDER_NEWPOST = 1;
CCommentThread.RENDER_GOTOPAGE = 2;
CCommentThread.RENDER_GOTOCOMMENT = 3;
CCommentThread.RENDER_DELETEDPOST = 4;
CCommentThread.RENDER_GOTOPAGE_HASHCHANGE = 5;
CCommentThread.RENDER_GOTOCOMMENT_HASHCHANGE = 6;

// static accessor
CCommentThread.DeleteComment = function( id, gidcomment )
{
	if ( g_rgCommentThreads[id] )
		g_rgCommentThreads[id].DeleteComment( gidcomment );
};
CCommentThread.UnDeleteComment = function( id, gidcomment )
{
	if ( g_rgCommentThreads[id] )
		g_rgCommentThreads[id].DeleteComment( gidcomment, true );
};
// static accessor
CCommentThread.EditComment = function( id, gidcomment )
{
	if ( g_rgCommentThreads[id] )
		g_rgCommentThreads[id].DisplayEditComment( gidcomment );
};
// static accessor
CCommentThread.VoteUp = function( id )
{
	if ( g_rgCommentThreads[id] )
		g_rgCommentThreads[id].VoteUp();
};
// static accessor
CCommentThread.UpdateAnswer = function( id, gidcomment, bExisting )
{
	if ( g_rgCommentThreads[id] )
		g_rgCommentThreads[id].UpdateAnswer( gidcomment, bExisting );
};
CCommentThread.FormattingHelpPopup = function( strCommentThreadType )
{
	$J.get( 'http://steamcommunity.com/comment/' + strCommentThreadType + '/formattinghelp', {ajax:1} ).done( function(data) {
		ShowAlertDialog( 'Text Formatting', data );
	});
};
CCommentThread.ShowDeletedComment = function( id, gidcomment )
{
	var elComment = $('comment_' + gidcomment);
	var elDeletedComment = $('deleted_comment_' + gidcomment );
	elComment.show();
	elDeletedComment.hide();
};





CGameSelector = Class.create( {
	bHaveSuggestions: false,
	elInput: null,
	elSuggestionsCtn: null,
	elSuggestions: null,
	fnOnClick: null,

	elFocus: null,
	nAppIDFocus: 0,

	initialize: function( elInput, elSuggestionsCtn, elSuggestions, fnOnClick )
	{
		this.elInput = elInput;
		this.elSuggestionsCtn = elSuggestionsCtn;
		this.elSuggestions = elSuggestions;

		if ( !this.elSuggestions && !this.elSuggestionsCtn )
		{
			// build them
			this.elSuggestions = new Element( 'div', {'class': 'shadow_content popup_body popup_menu' } );
			this.elSuggestionsCtn = new Element( 'div', {'class': 'popup_block', style: 'display: none; z-index: 1200;' } );
			this.elSuggestionsCtn.update( '<div class="shadow_ul"></div><div class="shadow_top"></div><div class="shadow_ur"></div><div class="shadow_left"></div><div class="shadow_right"></div><div class="shadow_bl"></div><div class="shadow_bottom"></div><div class="shadow_br"></div>' );
			this.elSuggestionsCtn.insert( {bottom: this.elSuggestions } );
			$(document.body).appendChild( this.elSuggestionsCtn );
		}

		this.fnOnClick = function( Selector, rgAppData ) { Selector.HideSuggestions(); fnOnClick( Selector, rgAppData ); };

		new Form.Element.Observer( elInput, 0.2, this.OnGameSelectTextEntry.bind(this) );
		elInput.observe( 'blur', this.HideSuggestions.bind(this) );
		elInput.observe( 'focus', this.ShowSuggestions.bind(this) );
		elInput.observe( 'keydown', this.OnGameSelectKeyDown.bindAsEventListener( this, elInput ) );
	},

	ShowSuggestions: function()
	{
		if ( !this.elSuggestionsCtn.visible() && this.bHaveSuggestions )
		{
			AlignMenu( this.elInput, this.elSuggestionsCtn, 'left', 'bottom', true );
			ShowWithFade( this.elSuggestionsCtn );
		}
	},

	HideSuggestions: function()
	{
		HideWithFade( this.elSuggestionsCtn );
	},

	OnGameSelectTextEntry: function( elInput, value )
	{
		if ( value )
		{
			new Ajax.Request( 'http://steamcommunity.com/actions/SearchApps/' + encodeURIComponent( value ), {
				method: 'get',
				onSuccess: this.ReceiveGameSelectResponse.bind( this, value )
			} );
		}
		else
		{
			this.elSuggestions.update('');
			this.bHaveSuggestions = false;
		}
	},

	OnGameSelectKeyDown: function( event, elem )
	{
		if ( event.keyCode == Event.KEY_ESC )
		{
			this.HideSuggestions();
		}
		else if ( this.bHaveSuggestions )
		{
			var elNewSuggestion = null;

			if ( event.keyCode == Event.KEY_RETURN )
			{
				if ( this.elFocus )
				{
					this.elFocus.fnOnSelect();
					event.stop();
				}
			}
			else if ( event.keyCode == Event.KEY_UP )
			{
				if ( this.elFocus )
					elNewSuggestion = this.elFocus.previous();
				if ( !elNewSuggestion )
					elNewSuggestion = this.elSuggestions.select(":last-child")[0];
			}
			else if ( event.keyCode == Event.KEY_DOWN )
			{
				if ( this.elFocus )
					elNewSuggestion = this.elFocus.next();
				if ( !elNewSuggestion )
					elNewSuggestion = this.elSuggestions.childElements()[0];
			}

			if ( elNewSuggestion )
				this.SetFocus( elNewSuggestion );
		}
	},

	ReceiveGameSelectResponse: function( value, transport )
	{
		if ( this.elInput.value == value )
		{

			var json = transport.responseJSON;
			this.UpdateListWithOptions( json );

		}
	},

	UpdateListWithOptions: function( rgOptions )
	{
		this.elSuggestions.update('');
		this.elFocus = null;
		if ( rgOptions && rgOptions.length )
		{
			for ( var i=0; i < rgOptions.length; i++ )
			{
				var elSuggestion = new Element( 'div', {'class': 'game_suggestion popup_menu_item' } );
				$J(elSuggestion).text( rgOptions[i].name );

				elSuggestion.appid = rgOptions[i].appid;
				elSuggestion.fnOnSelect = this.fnOnClick.bind( null, this, rgOptions[i] );
				elSuggestion.observe( 'click', elSuggestion.fnOnSelect );
				elSuggestion.observe( 'mouseover', this.SetFocus.bind( this, elSuggestion ) );

				this.elSuggestions.insert( {bottom: elSuggestion } );

				if ( this.nAppIDFocus == elSuggestion.appid )
					this.SetFocus( elSuggestion );
			}
			this.bHaveSuggestions = true;
			this.ShowSuggestions();
		}
		else
		{
			this.bHaveSuggestions = false;
			this.HideSuggestions();
		}
	},


	SetFocus: function( elSuggestion )
	{
		if ( this.elFocus )
			this.elFocus.removeClassName( 'focus' );

		this.elFocus = elSuggestion;
		this.nAppIDFocus = elSuggestion.appid;
		elSuggestion.addClassName( 'focus' );
	}


} );

CGameSelectorWorkshopGames = Class.create( CGameSelector, {
	OnGameSelectTextEntry: function( elInput, value )
	{
		if ( value )
		{
			new Ajax.Request( 'http://steamcommunity.com/workshop/ajaxfindworkshops/?searchText=' + encodeURIComponent( value ), {
				method: 'get',
				onSuccess: this.ReceiveGameSelectResponse.bind( this, value )
			} );
		}
		else
		{
			this.elSuggestions.update('');
			this.bHaveSuggestions = false;
		}
	}
} );

CGameSelectorOwnedGames = Class.create( CGameSelector, {

	m_bOwnedGamesReady: false,

	initialize: function( $super, elInput, elSuggestionsCtn, elSuggestions, fnOnClick )
	{
		$super( elInput, elSuggestionsCtn, elSuggestions, fnOnClick );
		CGameSelectorOwnedGames.LoadOwnedGames( this.OnOwnedGamesReady.bind( this ) );
	},

	OnOwnedGamesReady: function()
	{
		this.m_bOwnedGamesReady = true;
		this.OnGameSelectTextEntry( this.elInput, this.elInput.value );
	},

	OnGameSelectTextEntry: function( elInput, value )
	{
		if ( value )
		{
			if ( !this.m_bOwnedGamesReady )
			{
				this.elSuggestions.update( '<div style="text-align: center; width: 200px; padding: 5px 0;"><img src="http://community.edgecast.steamstatic.com/public/images/login/throbber.gif"></div>' );
				this.bHaveSuggestions = true;
				this.ShowSuggestions();
			}
			else
			{
				var rgTerms = value.toLowerCase().split( ' ' );
				var rgRegex = [];
				for ( var iTerm = 0; iTerm < rgTerms.length; iTerm++ )
				{
					var term = V_EscapeRegExp( rgTerms[iTerm] );
					rgRegex.push( new RegExp( term ) );
				}
				var rgMatchingGames = [];
				for ( var i = 0; i < CGameSelectorOwnedGames.s_rgOwnedGames.length; i++ )
				{
					var game = CGameSelectorOwnedGames.s_rgOwnedGames[i];
					var bMatch = true;
					for ( var iRegex = 0; iRegex < rgRegex.length; iRegex++ )
					{
						if ( !rgRegex[iRegex].match( game.name_normalized ) )
						{
							bMatch = false;
							break;
						}
					}
					if ( bMatch )
					{
						rgMatchingGames.push( game );
						if ( rgMatchingGames.length >= 10 )
							break;
					}
				}

				rgMatchingGames.sort( function( a, b ) {
					if ( a.name < b.name )
						return -1;
					else if ( b.name < a.name )
						return 1;
					else
						return 0;
				} );

				this.UpdateListWithOptions( rgMatchingGames );
			}
		}
		else
		{
			this.elSuggestions.update('');
			this.bHaveSuggestions = false;
		}
	}

} );

CGameSelectorOwnedGames.s_rgOwnedGames = null;
CGameSelectorOwnedGames.s_bLoadInFlight = false;
CGameSelectorOwnedGames.s_rgOwnedGamesReadyCallbacks = [];
CGameSelectorOwnedGames.AreOwnedGamesLoaded = function()
{
	return CGameSelectorOwnedGames.s_rgOwnedGames != null;
};
CGameSelectorOwnedGames.LoadOwnedGames = function( fnCallback )
{
	if ( !CGameSelectorOwnedGames.AreOwnedGamesLoaded() )
	{
		CGameSelectorOwnedGames.s_rgOwnedGamesReadyCallbacks.push( fnCallback );

		if ( CGameSelectorOwnedGames.s_bLoadInFlight )
			return;

		CGameSelectorOwnedGames.s_bLoadInFlight = true;

		new Ajax.Request( 'http://steamcommunity.com/actions/GetOwnedApps/', {
			method: 'get',
			parameters: {sessionid: g_sessionID },
			onSuccess: function( transport )
			{
				CGameSelectorOwnedGames.s_rgOwnedGames = transport.responseJSON || [];

				var regexNormalize = new RegExp( /[^0-9a-zA-Z]/g );
				for( var i=0; i < CGameSelectorOwnedGames.s_rgOwnedGames.length; i++ )
				{
					var game = CGameSelectorOwnedGames.s_rgOwnedGames[i];
					game.name_normalized = game.name.replace( regexNormalize, '' ).toLowerCase();
				}
			},
			onFailure: function()
			{
				CGameSelectorOwnedGames.s_rgOwnedGames = [];
			},
			onComplete: function()
			{
				for ( var i = 0; i < CGameSelectorOwnedGames.s_rgOwnedGamesReadyCallbacks.length; i++ )
				{
					CGameSelectorOwnedGames.s_rgOwnedGamesReadyCallbacks[i]();
				}
			}
		} );
	}
	else
	{
		// data is already ready
		fnCallback();
	}
};


function TargetIsChild( event, selector )
{
	var evt = event || window.event;
	var reltarget = evt.relatedTarget || evt.toElement;
	if ( !reltarget || !$(reltarget).up( selector ) )
		return false;
	return true;
}

function addEvent(el, ev, fn, useCapture)
{
	if(el.addEventListener)
	{
		el.addEventListener(ev, fn, useCapture);
	}
	else if(el.attachEvent)
	{
		var ret = el.attachEvent("on"+ev, fn);
		return ret;
	}
	else
	{
		el["on"+ev] = fn;
	}
}

function createQuery2( postUrl, returnFn, postData )
{
	var uid = Math.round(Math.random()*100000);
	var rUid = "requester"+uid;
	eval(rUid+" = new xHttpQuery_Post();");
	eval(rUid+".postUrl = postUrl;");
	eval(rUid+".returnFn = returnFn;");
	eval(rUid+".postData = postData;");
	eval(rUid+".selfRef = \""+rUid+"\";");
	eval(rUid+".doRequest();");
}

var updateInProgress = false;
function xHttpQuery_Post()
{
	this.postUrl = '';
	this.selfRef = '';
	this.postData = '';
	this.dataEncoded = false;
	this.returnFn = false;
	this.doRequest = function()
	{
		if ( updateInProgress == true )
		{
			setTimeout( this.selfRef + ".doRequest()", 200 );
			return;
		}
		if ( this.dataEncoded == false )
		{
			var pairs = [];
			var regexp = /%20/g;
			for ( var name in this.postData )
			{
				var value = this.postData[name].toString();
				var pair = encodeURIComponent( name ).replace( regexp, '+' ) + '=' + encodeURIComponent( value ).replace( regexp, '+' );
				pairs.push( pair );
			}
			this.postData = pairs.join( '&' );
			this.dataEncoded = true;
		}
		updateInProgress = true;
		// req is intentionally a global.  The contract for this function is that the callers look at the "req" global in their callback to see results.
		if ( window.XMLHttpRequest )
		{
			req = new XMLHttpRequest();
		}
		else if( window.ActiveXObject )
		{
			req = new ActiveXObject( "Microsoft.XMLHTTP" );
		}
		if ( req )
		{
			req.open( "POST", this.postUrl, true );
			req.onreadystatechange = this.returnFn;
			req.setRequestHeader( "Content-Type", "application/x-www-form-urlencoded" );
			req.setRequestHeader( "Content-Length", this.postData.length );
			req.send( this.postData );
		}
	}
}

function winDim(wh, vs)
{
	if(window.innerWidth) // most browsers - ff, safari, etc
	{
		return (wh == 'w' ? (vs == 'v' ? window.innerWidth : window.pageXOffset) : (vs == 'v' ? window.innerHeight : window.pageYOffset));
	}
	else if(document.documentElement && document.documentElement.clientWidth) // ie strict
	{
		return (wh == 'w' ? (vs == 'v' ? document.documentElement.clientWidth : document.documentElement.scrollLeft) : (vs == 'v' ? document.documentElement.clientHeight : document.documentElement.scrollTop));
	}
	else // ie normal
	{
		return (wh == 'w' ? (vs == 'v' ? document.body.clientWidth : document.body.scrollLeft) : (vs == 'v' ? document.body.clientHeight : document.body.scrollTop));
	}
}

function getGoodElement(el,nn,cn,next)
{
	if(next == 1)
	{
		el = el.parentNode;
	}
	while( el.nodeName && el.nodeName.toLowerCase() != nn && el.nodeName.toLowerCase() != "body")
	{
		el = el.parentNode;
	}
	var thisClass = ' '+el.className+' ';
	if( el.nodeName && el.nodeName.toLowerCase() != "body" && thisClass.indexOf(' '+cn+' ') == -1)
	{
		return getGoodElement(el,nn,cn,1);
	}
	else if(thisClass.indexOf(' '+cn+' ') != -1)
	{
		return el;
	}
	return false;
}
function addGameActions()
{
	if(!document.getElementsByTagName)
	{
		return;
	}
	var pageDivs = document.getElementsByTagName("div");
	for(var x = 0; x < pageDivs.length; x++)
	{
		var tempClassName = " "+pageDivs[x].className+" ";
		var tempParentClassName = " "+pageDivs[x].parentNode.className+" ";
		if(tempClassName.indexOf(" gameContainer ") != -1 || tempParentClassName.indexOf(" gameContainer ") != -1)
		{
			addEvent(pageDivs[x], "mouseover", listItem_hilite, false);
			addEvent(pageDivs[x], "mouseout", listItem_lolite, false);
			addEvent(pageDivs[x], "click", listItem_toggle, false);
		}
	}
}

function getPopPos(e, pw, ph, offset)
{
	var w = winDim('w','v');
	var h = winDim('h','v');
	var sl = winDim('w','s');
	var st = winDim('h','s');
	// mouse x/y within viewport
	var vmX = e.clientX;
	var vmY = e.clientY;
	// mouse x/y within document
	var smX = vmX + sl;
	var smY = vmY + st;
	var l = (pw > vmX) ? (smX + offset) : (smX - pw - offset);
	var t = (ph > vmY) ? (smY + offset) : (smY - ph - offset);
	var popTL = new Array(t, l);
	return popTL;
}

var keepTooltip = false;
function tooltipCreate(tipEl, e)
{
	var ttEl = document.getElementById('tooltip');
	if(ttEl)
	{
		ttEl.parentNode.removeChild(ttEl);
	}
	ttEl = document.createElement('div');
	ttEl.id = 'tooltip';
	ttEl.style.position = 'absolute';
	ttEl.appendChild(tipEl);
	document.getElementsByTagName('body')[0].appendChild(ttEl);
	var tipTL = getPopPos(e, ttEl.clientWidth, ttEl.clientHeight, 6);
	ttEl.style.top = tipTL[0] + 'px';
	ttEl.style.left = tipTL[1] + 'px';
}

function tooltipDestroy(go)
{
	if ( go != 1 )
	{
		setTimeout( "tooltipDestroy(1)", 10 );
	}
	else
	{
		var ttEl = document.getElementById('tooltip');
		if(ttEl)
		{
			ttEl.parentNode.removeChild(ttEl);
		}
	}
}

function getElement( elementId )
{
	var elem;
	if ( document.getElementById ) // standard compliant method
		elem = document.getElementById( elementId );
	else if ( document.all ) // old msie versions
		elem = document.all[ elementId ];
	else
		elem = false;

	return elem;
}

function setImage( elementId, strImage )
{
	var imageElem = getElement( elementId );
	if ( !imageElem )
		return;

	imageElem.src = strImage;
}

function iSwapFullURL( imgID, newImg )
{
	var newImgPath = newImg;
	setImage( imgID, newImgPath );
}

function iSwap( imgID, newImg )
{
	var newImgPath = "http://community.edgecast.steamstatic.com/public/images/" + newImg;
	setImage( imgID, newImgPath );
}


function ListenToIFrameMessage( callbackFunc )
{
	// Respond to a posted message from our sub-frame
	var eventMethodAlias = ( window.addEventListener ) ? "addEventListener" : "attachEvent";
	var eventMethod = window[eventMethodAlias];
	var messageEvent = ( eventMethod === "attachEvent" ) ? "onmessage" : "message";

	eventMethod( messageEvent, callbackFunc, false );
}

var gSharePopup = null;
var gShareRequestURL = null;
function ShowSharePublishedFilePopup( publishedFileID, appID )
{
	gShareRequestURL = "http://steamcommunity.com/sharedfiles/shareonsteam/?id=" + publishedFileID + '&appid=' + appID;

	var shareURL = "http://steamcommunity.com/sharedfiles/filedetails/?id=" + publishedFileID;
	var baseSocialShareURL = "http://steamcommunity.com/sharedfiles/share/?id=" + publishedFileID;
	ShowSharePopup( shareURL, baseSocialShareURL );
}

function ShowShareNewsPostPopup( gid, appid )
{
	gShareRequestURL = "http://steamcommunity.com/news/shareonsteam/" + gid + "?appid=" + appid;

	var baseSocialShareURL = "http://steamcommunity.com/news/sharepost/" + gid;
	var shareURL = "http://steamcommunity.com/news/post/" + gid;
	ShowSharePopup( shareURL, baseSocialShareURL );
}

function ShowShareClanAnnouncementPopup( groupId, gid )
{
	gShareRequestURL = "http://steamcommunity.com/gid/" + groupId + "/announcements/shareonsteam/" + gid;

	var baseSocialShareURL = "http://steamcommunity.com/gid/" + groupId + "/announcements/share/" + gid;
	var shareURL = "http://steamcommunity.com/gid/" + groupId + "/announcements/detail/" + gid;
	ShowSharePopup( shareURL, baseSocialShareURL );
}

function ShowSharePopup( url, baseSocialShareURL )
{
	var appendQueryParam = baseSocialShareURL.indexOf( "?" ) != -1 ? '&' : '?';

	$( "SharePopupLink_Facebook" ).href = baseSocialShareURL + appendQueryParam + "site=facebook&t=" + Math.random();
	$( "SharePopupLink_Twitter" ).href = baseSocialShareURL + appendQueryParam + "site=twitter";
	$( "SharePopupLink_Reddit" ).href = baseSocialShareURL + appendQueryParam + "site=reddit";
	$( "SharePopupLink_Digg" ).href = baseSocialShareURL + appendQueryParam + "site=digg";

	$( "SharePopupInput" ).value = url;

	gSharePopup = ShowDialog( 'Share', $( 'SharePopup' ) );
	gSharePopup.SetRemoveContentOnDismissal( false );
	$( 'SharePopup' ).show();
}

var gShareOnSteamDialog = null;
function ShareOnSteam()
{
	gSharePopup.Dismiss();
	gSharePopup = null;

	$( 'ShareOnSteamDialogContents' ).hide();
	new Ajax.Updater( "ShareOnSteamDialogContents", gShareRequestURL, { evalScripts: true, onLoaded: function() { ShowWithFade( $( 'ShareOnSteamDialogContents') ); } } );
	$( 'ShareOnSteamDialog' ).show();

	var deferred = new jQuery.Deferred();
	var fnCancel = function() { CloseShareOnSteamDialog(); deferred.resolve(); };

	gShareOnSteamDialog = _BuildDialog(  'Share', $( 'ShareOnSteamDialog' ), [], fnCancel, null );
	deferred.always( function() { gShareOnSteamDialog.Dismiss(); } );
	gShareOnSteamDialog.Show();

	// attach the deferred's events to the modal
	deferred.promise( gShareOnSteamDialog );

	gShareOnSteamDialog.SetRemoveContentOnDismissal( false );
}


function CloseShareOnSteamDialog()
{
		gShareOnSteamDialog.Dismiss();
}

function ShareContentToUserStatus( text, urlToShare, appID, posturl )
{
	text += '\n\n' + urlToShare;
	new Ajax.Request( posturl, {
		insertion: Insertion.Bottom,
		method: 'post',
		parameters: { sessionid: g_sessionID, status_text: text, appid: appID },
		onSuccess: function(transport) {
			CloseShareOnSteamDialog();
			ShowAlertDialog( 'Share', 'The status update has been posted to your Friends Activity.' );
		},
		onFailure: function(transport) {
			ShowAlertDialog( 'Share', 'There was a problem sharing the status update.  Please try again later.' );
		}
	});
}






/*! jQuery v1.11.1 | (c) 2005, 2014 jQuery Foundation, Inc. | jquery.org/license */
!function(a,b){"object"==typeof module&&"object"==typeof module.exports?module.exports=a.document?b(a,!0):function(a){if(!a.document)throw new Error("jQuery requires a window with a document");return b(a)}:b(a)}("undefined"!=typeof window?window:this,function(a,b){var c=[],d=c.slice,e=c.concat,f=c.push,g=c.indexOf,h={},i=h.toString,j=h.hasOwnProperty,k={},l="1.11.1",m=function(a,b){return new m.fn.init(a,b)},n=/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g,o=/^-ms-/,p=/-([\da-z])/gi,q=function(a,b){return b.toUpperCase()};m.fn=m.prototype={jquery:l,constructor:m,selector:"",length:0,toArray:function(){return d.call(this)},get:function(a){return null!=a?0>a?this[a+this.length]:this[a]:d.call(this)},pushStack:function(a){var b=m.merge(this.constructor(),a);return b.prevObject=this,b.context=this.context,b},each:function(a,b){return m.each(this,a,b)},map:function(a){return this.pushStack(m.map(this,function(b,c){return a.call(b,c,b)}))},slice:function(){return this.pushStack(d.apply(this,arguments))},first:function(){return this.eq(0)},last:function(){return this.eq(-1)},eq:function(a){var b=this.length,c=+a+(0>a?b:0);return this.pushStack(c>=0&&b>c?[this[c]]:[])},end:function(){return this.prevObject||this.constructor(null)},push:f,sort:c.sort,splice:c.splice},m.extend=m.fn.extend=function(){var a,b,c,d,e,f,g=arguments[0]||{},h=1,i=arguments.length,j=!1;for("boolean"==typeof g&&(j=g,g=arguments[h]||{},h++),"object"==typeof g||m.isFunction(g)||(g={}),h===i&&(g=this,h--);i>h;h++)if(null!=(e=arguments[h]))for(d in e)a=g[d],c=e[d],g!==c&&(j&&c&&(m.isPlainObject(c)||(b=m.isArray(c)))?(b?(b=!1,f=a&&m.isArray(a)?a:[]):f=a&&m.isPlainObject(a)?a:{},g[d]=m.extend(j,f,c)):void 0!==c&&(g[d]=c));return g},m.extend({expando:"jQuery"+(l+Math.random()).replace(/\D/g,""),isReady:!0,error:function(a){throw new Error(a)},noop:function(){},isFunction:function(a){return"function"===m.type(a)},isArray:Array.isArray||function(a){return"array"===m.type(a)},isWindow:function(a){return null!=a&&a==a.window},isNumeric:function(a){return!m.isArray(a)&&a-parseFloat(a)>=0},isEmptyObject:function(a){var b;for(b in a)return!1;return!0},isPlainObject:function(a){var b;if(!a||"object"!==m.type(a)||a.nodeType||m.isWindow(a))return!1;try{if(a.constructor&&!j.call(a,"constructor")&&!j.call(a.constructor.prototype,"isPrototypeOf"))return!1}catch(c){return!1}if(k.ownLast)for(b in a)return j.call(a,b);for(b in a);return void 0===b||j.call(a,b)},type:function(a){return null==a?a+"":"object"==typeof a||"function"==typeof a?h[i.call(a)]||"object":typeof a},globalEval:function(b){b&&m.trim(b)&&(a.execScript||function(b){a.eval.call(a,b)})(b)},camelCase:function(a){return a.replace(o,"ms-").replace(p,q)},nodeName:function(a,b){return a.nodeName&&a.nodeName.toLowerCase()===b.toLowerCase()},each:function(a,b,c){var d,e=0,f=a.length,g=r(a);if(c){if(g){for(;f>e;e++)if(d=b.apply(a[e],c),d===!1)break}else for(e in a)if(d=b.apply(a[e],c),d===!1)break}else if(g){for(;f>e;e++)if(d=b.call(a[e],e,a[e]),d===!1)break}else for(e in a)if(d=b.call(a[e],e,a[e]),d===!1)break;return a},trim:function(a){return null==a?"":(a+"").replace(n,"")},makeArray:function(a,b){var c=b||[];return null!=a&&(r(Object(a))?m.merge(c,"string"==typeof a?[a]:a):f.call(c,a)),c},inArray:function(a,b,c){var d;if(b){if(g)return g.call(b,a,c);for(d=b.length,c=c?0>c?Math.max(0,d+c):c:0;d>c;c++)if(c in b&&b[c]===a)return c}return-1},merge:function(a,b){var c=+b.length,d=0,e=a.length;while(c>d)a[e++]=b[d++];if(c!==c)while(void 0!==b[d])a[e++]=b[d++];return a.length=e,a},grep:function(a,b,c){for(var d,e=[],f=0,g=a.length,h=!c;g>f;f++)d=!b(a[f],f),d!==h&&e.push(a[f]);return e},map:function(a,b,c){var d,f=0,g=a.length,h=r(a),i=[];if(h)for(;g>f;f++)d=b(a[f],f,c),null!=d&&i.push(d);else for(f in a)d=b(a[f],f,c),null!=d&&i.push(d);return e.apply([],i)},guid:1,proxy:function(a,b){var c,e,f;return"string"==typeof b&&(f=a[b],b=a,a=f),m.isFunction(a)?(c=d.call(arguments,2),e=function(){return a.apply(b||this,c.concat(d.call(arguments)))},e.guid=a.guid=a.guid||m.guid++,e):void 0},now:function(){return+new Date},support:k}),m.each("Boolean Number String Function Array Date RegExp Object Error".split(" "),function(a,b){h["[object "+b+"]"]=b.toLowerCase()});function r(a){var b=a.length,c=m.type(a);return"function"===c||m.isWindow(a)?!1:1===a.nodeType&&b?!0:"array"===c||0===b||"number"==typeof b&&b>0&&b-1 in a}var s=function(a){var b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u="sizzle"+-new Date,v=a.document,w=0,x=0,y=gb(),z=gb(),A=gb(),B=function(a,b){return a===b&&(l=!0),0},C="undefined",D=1<<31,E={}.hasOwnProperty,F=[],G=F.pop,H=F.push,I=F.push,J=F.slice,K=F.indexOf||function(a){for(var b=0,c=this.length;c>b;b++)if(this[b]===a)return b;return-1},L="checked|selected|async|autofocus|autoplay|controls|defer|disabled|hidden|ismap|loop|multiple|open|readonly|required|scoped",M="[\\x20\\t\\r\\n\\f]",N="(?:\\\\.|[\\w-]|[^\\x00-\\xa0])+",O=N.replace("w","w#"),P="\\["+M+"*("+N+")(?:"+M+"*([*^$|!~]?=)"+M+"*(?:'((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\"|("+O+"))|)"+M+"*\\]",Q=":("+N+")(?:\\((('((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\")|((?:\\\\.|[^\\\\()[\\]]|"+P+")*)|.*)\\)|)",R=new RegExp("^"+M+"+|((?:^|[^\\\\])(?:\\\\.)*)"+M+"+$","g"),S=new RegExp("^"+M+"*,"+M+"*"),T=new RegExp("^"+M+"*([>+~]|"+M+")"+M+"*"),U=new RegExp("="+M+"*([^\\]'\"]*?)"+M+"*\\]","g"),V=new RegExp(Q),W=new RegExp("^"+O+"$"),X={ID:new RegExp("^#("+N+")"),CLASS:new RegExp("^\\.("+N+")"),TAG:new RegExp("^("+N.replace("w","w*")+")"),ATTR:new RegExp("^"+P),PSEUDO:new RegExp("^"+Q),CHILD:new RegExp("^:(only|first|last|nth|nth-last)-(child|of-type)(?:\\("+M+"*(even|odd|(([+-]|)(\\d*)n|)"+M+"*(?:([+-]|)"+M+"*(\\d+)|))"+M+"*\\)|)","i"),bool:new RegExp("^(?:"+L+")$","i"),needsContext:new RegExp("^"+M+"*[>+~]|:(even|odd|eq|gt|lt|nth|first|last)(?:\\("+M+"*((?:-\\d)?\\d*)"+M+"*\\)|)(?=[^-]|$)","i")},Y=/^(?:input|select|textarea|button)$/i,Z=/^h\d$/i,$=/^[^{]+\{\s*\[native \w/,_=/^(?:#([\w-]+)|(\w+)|\.([\w-]+))$/,ab=/[+~]/,bb=/'|\\/g,cb=new RegExp("\\\\([\\da-f]{1,6}"+M+"?|("+M+")|.)","ig"),db=function(a,b,c){var d="0x"+b-65536;return d!==d||c?b:0>d?String.fromCharCode(d+65536):String.fromCharCode(d>>10|55296,1023&d|56320)};try{I.apply(F=J.call(v.childNodes),v.childNodes),F[v.childNodes.length].nodeType}catch(eb){I={apply:F.length?function(a,b){H.apply(a,J.call(b))}:function(a,b){var c=a.length,d=0;while(a[c++]=b[d++]);a.length=c-1}}}function fb(a,b,d,e){var f,h,j,k,l,o,r,s,w,x;if((b?b.ownerDocument||b:v)!==n&&m(b),b=b||n,d=d||[],!a||"string"!=typeof a)return d;if(1!==(k=b.nodeType)&&9!==k)return[];if(p&&!e){if(f=_.exec(a))if(j=f[1]){if(9===k){if(h=b.getElementById(j),!h||!h.parentNode)return d;if(h.id===j)return d.push(h),d}else if(b.ownerDocument&&(h=b.ownerDocument.getElementById(j))&&t(b,h)&&h.id===j)return d.push(h),d}else{if(f[2])return I.apply(d,b.getElementsByTagName(a)),d;if((j=f[3])&&c.getElementsByClassName&&b.getElementsByClassName)return I.apply(d,b.getElementsByClassName(j)),d}if(c.qsa&&(!q||!q.test(a))){if(s=r=u,w=b,x=9===k&&a,1===k&&"object"!==b.nodeName.toLowerCase()){o=g(a),(r=b.getAttribute("id"))?s=r.replace(bb,"\\$&"):b.setAttribute("id",s),s="[id='"+s+"'] ",l=o.length;while(l--)o[l]=s+qb(o[l]);w=ab.test(a)&&ob(b.parentNode)||b,x=o.join(",")}if(x)try{return I.apply(d,w.querySelectorAll(x)),d}catch(y){}finally{r||b.removeAttribute("id")}}}return i(a.replace(R,"$1"),b,d,e)}function gb(){var a=[];function b(c,e){return a.push(c+" ")>d.cacheLength&&delete b[a.shift()],b[c+" "]=e}return b}function hb(a){return a[u]=!0,a}function ib(a){var b=n.createElement("div");try{return!!a(b)}catch(c){return!1}finally{b.parentNode&&b.parentNode.removeChild(b),b=null}}function jb(a,b){var c=a.split("|"),e=a.length;while(e--)d.attrHandle[c[e]]=b}function kb(a,b){var c=b&&a,d=c&&1===a.nodeType&&1===b.nodeType&&(~b.sourceIndex||D)-(~a.sourceIndex||D);if(d)return d;if(c)while(c=c.nextSibling)if(c===b)return-1;return a?1:-1}function lb(a){return function(b){var c=b.nodeName.toLowerCase();return"input"===c&&b.type===a}}function mb(a){return function(b){var c=b.nodeName.toLowerCase();return("input"===c||"button"===c)&&b.type===a}}function nb(a){return hb(function(b){return b=+b,hb(function(c,d){var e,f=a([],c.length,b),g=f.length;while(g--)c[e=f[g]]&&(c[e]=!(d[e]=c[e]))})})}function ob(a){return a&&typeof a.getElementsByTagName!==C&&a}c=fb.support={},f=fb.isXML=function(a){var b=a&&(a.ownerDocument||a).documentElement;return b?"HTML"!==b.nodeName:!1},m=fb.setDocument=function(a){var b,e=a?a.ownerDocument||a:v,g=e.defaultView;return e!==n&&9===e.nodeType&&e.documentElement?(n=e,o=e.documentElement,p=!f(e),g&&g!==g.top&&(g.addEventListener?g.addEventListener("unload",function(){m()},!1):g.attachEvent&&g.attachEvent("onunload",function(){m()})),c.attributes=ib(function(a){return a.className="i",!a.getAttribute("className")}),c.getElementsByTagName=ib(function(a){return a.appendChild(e.createComment("")),!a.getElementsByTagName("*").length}),c.getElementsByClassName=$.test(e.getElementsByClassName)&&ib(function(a){return a.innerHTML="<div class='a'></div><div class='a i'></div>",a.firstChild.className="i",2===a.getElementsByClassName("i").length}),c.getById=ib(function(a){return o.appendChild(a).id=u,!e.getElementsByName||!e.getElementsByName(u).length}),c.getById?(d.find.ID=function(a,b){if(typeof b.getElementById!==C&&p){var c=b.getElementById(a);return c&&c.parentNode?[c]:[]}},d.filter.ID=function(a){var b=a.replace(cb,db);return function(a){return a.getAttribute("id")===b}}):(delete d.find.ID,d.filter.ID=function(a){var b=a.replace(cb,db);return function(a){var c=typeof a.getAttributeNode!==C&&a.getAttributeNode("id");return c&&c.value===b}}),d.find.TAG=c.getElementsByTagName?function(a,b){return typeof b.getElementsByTagName!==C?b.getElementsByTagName(a):void 0}:function(a,b){var c,d=[],e=0,f=b.getElementsByTagName(a);if("*"===a){while(c=f[e++])1===c.nodeType&&d.push(c);return d}return f},d.find.CLASS=c.getElementsByClassName&&function(a,b){return typeof b.getElementsByClassName!==C&&p?b.getElementsByClassName(a):void 0},r=[],q=[],(c.qsa=$.test(e.querySelectorAll))&&(ib(function(a){a.innerHTML="<select msallowclip=''><option selected=''></option></select>",a.querySelectorAll("[msallowclip^='']").length&&q.push("[*^$]="+M+"*(?:''|\"\")"),a.querySelectorAll("[selected]").length||q.push("\\["+M+"*(?:value|"+L+")"),a.querySelectorAll(":checked").length||q.push(":checked")}),ib(function(a){var b=e.createElement("input");b.setAttribute("type","hidden"),a.appendChild(b).setAttribute("name","D"),a.querySelectorAll("[name=d]").length&&q.push("name"+M+"*[*^$|!~]?="),a.querySelectorAll(":enabled").length||q.push(":enabled",":disabled"),a.querySelectorAll("*,:x"),q.push(",.*:")})),(c.matchesSelector=$.test(s=o.matches||o.webkitMatchesSelector||o.mozMatchesSelector||o.oMatchesSelector||o.msMatchesSelector))&&ib(function(a){c.disconnectedMatch=s.call(a,"div"),s.call(a,"[s!='']:x"),r.push("!=",Q)}),q=q.length&&new RegExp(q.join("|")),r=r.length&&new RegExp(r.join("|")),b=$.test(o.compareDocumentPosition),t=b||$.test(o.contains)?function(a,b){var c=9===a.nodeType?a.documentElement:a,d=b&&b.parentNode;return a===d||!(!d||1!==d.nodeType||!(c.contains?c.contains(d):a.compareDocumentPosition&&16&a.compareDocumentPosition(d)))}:function(a,b){if(b)while(b=b.parentNode)if(b===a)return!0;return!1},B=b?function(a,b){if(a===b)return l=!0,0;var d=!a.compareDocumentPosition-!b.compareDocumentPosition;return d?d:(d=(a.ownerDocument||a)===(b.ownerDocument||b)?a.compareDocumentPosition(b):1,1&d||!c.sortDetached&&b.compareDocumentPosition(a)===d?a===e||a.ownerDocument===v&&t(v,a)?-1:b===e||b.ownerDocument===v&&t(v,b)?1:k?K.call(k,a)-K.call(k,b):0:4&d?-1:1)}:function(a,b){if(a===b)return l=!0,0;var c,d=0,f=a.parentNode,g=b.parentNode,h=[a],i=[b];if(!f||!g)return a===e?-1:b===e?1:f?-1:g?1:k?K.call(k,a)-K.call(k,b):0;if(f===g)return kb(a,b);c=a;while(c=c.parentNode)h.unshift(c);c=b;while(c=c.parentNode)i.unshift(c);while(h[d]===i[d])d++;return d?kb(h[d],i[d]):h[d]===v?-1:i[d]===v?1:0},e):n},fb.matches=function(a,b){return fb(a,null,null,b)},fb.matchesSelector=function(a,b){if((a.ownerDocument||a)!==n&&m(a),b=b.replace(U,"='$1']"),!(!c.matchesSelector||!p||r&&r.test(b)||q&&q.test(b)))try{var d=s.call(a,b);if(d||c.disconnectedMatch||a.document&&11!==a.document.nodeType)return d}catch(e){}return fb(b,n,null,[a]).length>0},fb.contains=function(a,b){return(a.ownerDocument||a)!==n&&m(a),t(a,b)},fb.attr=function(a,b){(a.ownerDocument||a)!==n&&m(a);var e=d.attrHandle[b.toLowerCase()],f=e&&E.call(d.attrHandle,b.toLowerCase())?e(a,b,!p):void 0;return void 0!==f?f:c.attributes||!p?a.getAttribute(b):(f=a.getAttributeNode(b))&&f.specified?f.value:null},fb.error=function(a){throw new Error("Syntax error, unrecognized expression: "+a)},fb.uniqueSort=function(a){var b,d=[],e=0,f=0;if(l=!c.detectDuplicates,k=!c.sortStable&&a.slice(0),a.sort(B),l){while(b=a[f++])b===a[f]&&(e=d.push(f));while(e--)a.splice(d[e],1)}return k=null,a},e=fb.getText=function(a){var b,c="",d=0,f=a.nodeType;if(f){if(1===f||9===f||11===f){if("string"==typeof a.textContent)return a.textContent;for(a=a.firstChild;a;a=a.nextSibling)c+=e(a)}else if(3===f||4===f)return a.nodeValue}else while(b=a[d++])c+=e(b);return c},d=fb.selectors={cacheLength:50,createPseudo:hb,match:X,attrHandle:{},find:{},relative:{">":{dir:"parentNode",first:!0}," ":{dir:"parentNode"},"+":{dir:"previousSibling",first:!0},"~":{dir:"previousSibling"}},preFilter:{ATTR:function(a){return a[1]=a[1].replace(cb,db),a[3]=(a[3]||a[4]||a[5]||"").replace(cb,db),"~="===a[2]&&(a[3]=" "+a[3]+" "),a.slice(0,4)},CHILD:function(a){return a[1]=a[1].toLowerCase(),"nth"===a[1].slice(0,3)?(a[3]||fb.error(a[0]),a[4]=+(a[4]?a[5]+(a[6]||1):2*("even"===a[3]||"odd"===a[3])),a[5]=+(a[7]+a[8]||"odd"===a[3])):a[3]&&fb.error(a[0]),a},PSEUDO:function(a){var b,c=!a[6]&&a[2];return X.CHILD.test(a[0])?null:(a[3]?a[2]=a[4]||a[5]||"":c&&V.test(c)&&(b=g(c,!0))&&(b=c.indexOf(")",c.length-b)-c.length)&&(a[0]=a[0].slice(0,b),a[2]=c.slice(0,b)),a.slice(0,3))}},filter:{TAG:function(a){var b=a.replace(cb,db).toLowerCase();return"*"===a?function(){return!0}:function(a){return a.nodeName&&a.nodeName.toLowerCase()===b}},CLASS:function(a){var b=y[a+" "];return b||(b=new RegExp("(^|"+M+")"+a+"("+M+"|$)"))&&y(a,function(a){return b.test("string"==typeof a.className&&a.className||typeof a.getAttribute!==C&&a.getAttribute("class")||"")})},ATTR:function(a,b,c){return function(d){var e=fb.attr(d,a);return null==e?"!="===b:b?(e+="","="===b?e===c:"!="===b?e!==c:"^="===b?c&&0===e.indexOf(c):"*="===b?c&&e.indexOf(c)>-1:"$="===b?c&&e.slice(-c.length)===c:"~="===b?(" "+e+" ").indexOf(c)>-1:"|="===b?e===c||e.slice(0,c.length+1)===c+"-":!1):!0}},CHILD:function(a,b,c,d,e){var f="nth"!==a.slice(0,3),g="last"!==a.slice(-4),h="of-type"===b;return 1===d&&0===e?function(a){return!!a.parentNode}:function(b,c,i){var j,k,l,m,n,o,p=f!==g?"nextSibling":"previousSibling",q=b.parentNode,r=h&&b.nodeName.toLowerCase(),s=!i&&!h;if(q){if(f){while(p){l=b;while(l=l[p])if(h?l.nodeName.toLowerCase()===r:1===l.nodeType)return!1;o=p="only"===a&&!o&&"nextSibling"}return!0}if(o=[g?q.firstChild:q.lastChild],g&&s){k=q[u]||(q[u]={}),j=k[a]||[],n=j[0]===w&&j[1],m=j[0]===w&&j[2],l=n&&q.childNodes[n];while(l=++n&&l&&l[p]||(m=n=0)||o.pop())if(1===l.nodeType&&++m&&l===b){k[a]=[w,n,m];break}}else if(s&&(j=(b[u]||(b[u]={}))[a])&&j[0]===w)m=j[1];else while(l=++n&&l&&l[p]||(m=n=0)||o.pop())if((h?l.nodeName.toLowerCase()===r:1===l.nodeType)&&++m&&(s&&((l[u]||(l[u]={}))[a]=[w,m]),l===b))break;return m-=e,m===d||m%d===0&&m/d>=0}}},PSEUDO:function(a,b){var c,e=d.pseudos[a]||d.setFilters[a.toLowerCase()]||fb.error("unsupported pseudo: "+a);return e[u]?e(b):e.length>1?(c=[a,a,"",b],d.setFilters.hasOwnProperty(a.toLowerCase())?hb(function(a,c){var d,f=e(a,b),g=f.length;while(g--)d=K.call(a,f[g]),a[d]=!(c[d]=f[g])}):function(a){return e(a,0,c)}):e}},pseudos:{not:hb(function(a){var b=[],c=[],d=h(a.replace(R,"$1"));return d[u]?hb(function(a,b,c,e){var f,g=d(a,null,e,[]),h=a.length;while(h--)(f=g[h])&&(a[h]=!(b[h]=f))}):function(a,e,f){return b[0]=a,d(b,null,f,c),!c.pop()}}),has:hb(function(a){return function(b){return fb(a,b).length>0}}),contains:hb(function(a){return function(b){return(b.textContent||b.innerText||e(b)).indexOf(a)>-1}}),lang:hb(function(a){return W.test(a||"")||fb.error("unsupported lang: "+a),a=a.replace(cb,db).toLowerCase(),function(b){var c;do if(c=p?b.lang:b.getAttribute("xml:lang")||b.getAttribute("lang"))return c=c.toLowerCase(),c===a||0===c.indexOf(a+"-");while((b=b.parentNode)&&1===b.nodeType);return!1}}),target:function(b){var c=a.location&&a.location.hash;return c&&c.slice(1)===b.id},root:function(a){return a===o},focus:function(a){return a===n.activeElement&&(!n.hasFocus||n.hasFocus())&&!!(a.type||a.href||~a.tabIndex)},enabled:function(a){return a.disabled===!1},disabled:function(a){return a.disabled===!0},checked:function(a){var b=a.nodeName.toLowerCase();return"input"===b&&!!a.checked||"option"===b&&!!a.selected},selected:function(a){return a.parentNode&&a.parentNode.selectedIndex,a.selected===!0},empty:function(a){for(a=a.firstChild;a;a=a.nextSibling)if(a.nodeType<6)return!1;return!0},parent:function(a){return!d.pseudos.empty(a)},header:function(a){return Z.test(a.nodeName)},input:function(a){return Y.test(a.nodeName)},button:function(a){var b=a.nodeName.toLowerCase();return"input"===b&&"button"===a.type||"button"===b},text:function(a){var b;return"input"===a.nodeName.toLowerCase()&&"text"===a.type&&(null==(b=a.getAttribute("type"))||"text"===b.toLowerCase())},first:nb(function(){return[0]}),last:nb(function(a,b){return[b-1]}),eq:nb(function(a,b,c){return[0>c?c+b:c]}),even:nb(function(a,b){for(var c=0;b>c;c+=2)a.push(c);return a}),odd:nb(function(a,b){for(var c=1;b>c;c+=2)a.push(c);return a}),lt:nb(function(a,b,c){for(var d=0>c?c+b:c;--d>=0;)a.push(d);return a}),gt:nb(function(a,b,c){for(var d=0>c?c+b:c;++d<b;)a.push(d);return a})}},d.pseudos.nth=d.pseudos.eq;for(b in{radio:!0,checkbox:!0,file:!0,password:!0,image:!0})d.pseudos[b]=lb(b);for(b in{submit:!0,reset:!0})d.pseudos[b]=mb(b);function pb(){}pb.prototype=d.filters=d.pseudos,d.setFilters=new pb,g=fb.tokenize=function(a,b){var c,e,f,g,h,i,j,k=z[a+" "];if(k)return b?0:k.slice(0);h=a,i=[],j=d.preFilter;while(h){(!c||(e=S.exec(h)))&&(e&&(h=h.slice(e[0].length)||h),i.push(f=[])),c=!1,(e=T.exec(h))&&(c=e.shift(),f.push({value:c,type:e[0].replace(R," ")}),h=h.slice(c.length));for(g in d.filter)!(e=X[g].exec(h))||j[g]&&!(e=j[g](e))||(c=e.shift(),f.push({value:c,type:g,matches:e}),h=h.slice(c.length));if(!c)break}return b?h.length:h?fb.error(a):z(a,i).slice(0)};function qb(a){for(var b=0,c=a.length,d="";c>b;b++)d+=a[b].value;return d}function rb(a,b,c){var d=b.dir,e=c&&"parentNode"===d,f=x++;return b.first?function(b,c,f){while(b=b[d])if(1===b.nodeType||e)return a(b,c,f)}:function(b,c,g){var h,i,j=[w,f];if(g){while(b=b[d])if((1===b.nodeType||e)&&a(b,c,g))return!0}else while(b=b[d])if(1===b.nodeType||e){if(i=b[u]||(b[u]={}),(h=i[d])&&h[0]===w&&h[1]===f)return j[2]=h[2];if(i[d]=j,j[2]=a(b,c,g))return!0}}}function sb(a){return a.length>1?function(b,c,d){var e=a.length;while(e--)if(!a[e](b,c,d))return!1;return!0}:a[0]}function tb(a,b,c){for(var d=0,e=b.length;e>d;d++)fb(a,b[d],c);return c}function ub(a,b,c,d,e){for(var f,g=[],h=0,i=a.length,j=null!=b;i>h;h++)(f=a[h])&&(!c||c(f,d,e))&&(g.push(f),j&&b.push(h));return g}function vb(a,b,c,d,e,f){return d&&!d[u]&&(d=vb(d)),e&&!e[u]&&(e=vb(e,f)),hb(function(f,g,h,i){var j,k,l,m=[],n=[],o=g.length,p=f||tb(b||"*",h.nodeType?[h]:h,[]),q=!a||!f&&b?p:ub(p,m,a,h,i),r=c?e||(f?a:o||d)?[]:g:q;if(c&&c(q,r,h,i),d){j=ub(r,n),d(j,[],h,i),k=j.length;while(k--)(l=j[k])&&(r[n[k]]=!(q[n[k]]=l))}if(f){if(e||a){if(e){j=[],k=r.length;while(k--)(l=r[k])&&j.push(q[k]=l);e(null,r=[],j,i)}k=r.length;while(k--)(l=r[k])&&(j=e?K.call(f,l):m[k])>-1&&(f[j]=!(g[j]=l))}}else r=ub(r===g?r.splice(o,r.length):r),e?e(null,g,r,i):I.apply(g,r)})}function wb(a){for(var b,c,e,f=a.length,g=d.relative[a[0].type],h=g||d.relative[" "],i=g?1:0,k=rb(function(a){return a===b},h,!0),l=rb(function(a){return K.call(b,a)>-1},h,!0),m=[function(a,c,d){return!g&&(d||c!==j)||((b=c).nodeType?k(a,c,d):l(a,c,d))}];f>i;i++)if(c=d.relative[a[i].type])m=[rb(sb(m),c)];else{if(c=d.filter[a[i].type].apply(null,a[i].matches),c[u]){for(e=++i;f>e;e++)if(d.relative[a[e].type])break;return vb(i>1&&sb(m),i>1&&qb(a.slice(0,i-1).concat({value:" "===a[i-2].type?"*":""})).replace(R,"$1"),c,e>i&&wb(a.slice(i,e)),f>e&&wb(a=a.slice(e)),f>e&&qb(a))}m.push(c)}return sb(m)}function xb(a,b){var c=b.length>0,e=a.length>0,f=function(f,g,h,i,k){var l,m,o,p=0,q="0",r=f&&[],s=[],t=j,u=f||e&&d.find.TAG("*",k),v=w+=null==t?1:Math.random()||.1,x=u.length;for(k&&(j=g!==n&&g);q!==x&&null!=(l=u[q]);q++){if(e&&l){m=0;while(o=a[m++])if(o(l,g,h)){i.push(l);break}k&&(w=v)}c&&((l=!o&&l)&&p--,f&&r.push(l))}if(p+=q,c&&q!==p){m=0;while(o=b[m++])o(r,s,g,h);if(f){if(p>0)while(q--)r[q]||s[q]||(s[q]=G.call(i));s=ub(s)}I.apply(i,s),k&&!f&&s.length>0&&p+b.length>1&&fb.uniqueSort(i)}return k&&(w=v,j=t),r};return c?hb(f):f}return h=fb.compile=function(a,b){var c,d=[],e=[],f=A[a+" "];if(!f){b||(b=g(a)),c=b.length;while(c--)f=wb(b[c]),f[u]?d.push(f):e.push(f);f=A(a,xb(e,d)),f.selector=a}return f},i=fb.select=function(a,b,e,f){var i,j,k,l,m,n="function"==typeof a&&a,o=!f&&g(a=n.selector||a);if(e=e||[],1===o.length){if(j=o[0]=o[0].slice(0),j.length>2&&"ID"===(k=j[0]).type&&c.getById&&9===b.nodeType&&p&&d.relative[j[1].type]){if(b=(d.find.ID(k.matches[0].replace(cb,db),b)||[])[0],!b)return e;n&&(b=b.parentNode),a=a.slice(j.shift().value.length)}i=X.needsContext.test(a)?0:j.length;while(i--){if(k=j[i],d.relative[l=k.type])break;if((m=d.find[l])&&(f=m(k.matches[0].replace(cb,db),ab.test(j[0].type)&&ob(b.parentNode)||b))){if(j.splice(i,1),a=f.length&&qb(j),!a)return I.apply(e,f),e;break}}}return(n||h(a,o))(f,b,!p,e,ab.test(a)&&ob(b.parentNode)||b),e},c.sortStable=u.split("").sort(B).join("")===u,c.detectDuplicates=!!l,m(),c.sortDetached=ib(function(a){return 1&a.compareDocumentPosition(n.createElement("div"))}),ib(function(a){return a.innerHTML="<a href='#'></a>","#"===a.firstChild.getAttribute("href")})||jb("type|href|height|width",function(a,b,c){return c?void 0:a.getAttribute(b,"type"===b.toLowerCase()?1:2)}),c.attributes&&ib(function(a){return a.innerHTML="<input/>",a.firstChild.setAttribute("value",""),""===a.firstChild.getAttribute("value")})||jb("value",function(a,b,c){return c||"input"!==a.nodeName.toLowerCase()?void 0:a.defaultValue}),ib(function(a){return null==a.getAttribute("disabled")})||jb(L,function(a,b,c){var d;return c?void 0:a[b]===!0?b.toLowerCase():(d=a.getAttributeNode(b))&&d.specified?d.value:null}),fb}(a);m.find=s,m.expr=s.selectors,m.expr[":"]=m.expr.pseudos,m.unique=s.uniqueSort,m.text=s.getText,m.isXMLDoc=s.isXML,m.contains=s.contains;var t=m.expr.match.needsContext,u=/^<(\w+)\s*\/?>(?:<\/\1>|)$/,v=/^.[^:#\[\.,]*$/;function w(a,b,c){if(m.isFunction(b))return m.grep(a,function(a,d){return!!b.call(a,d,a)!==c});if(b.nodeType)return m.grep(a,function(a){return a===b!==c});if("string"==typeof b){if(v.test(b))return m.filter(b,a,c);b=m.filter(b,a)}return m.grep(a,function(a){return m.inArray(a,b)>=0!==c})}m.filter=function(a,b,c){var d=b[0];return c&&(a=":not("+a+")"),1===b.length&&1===d.nodeType?m.find.matchesSelector(d,a)?[d]:[]:m.find.matches(a,m.grep(b,function(a){return 1===a.nodeType}))},m.fn.extend({find:function(a){var b,c=[],d=this,e=d.length;if("string"!=typeof a)return this.pushStack(m(a).filter(function(){for(b=0;e>b;b++)if(m.contains(d[b],this))return!0}));for(b=0;e>b;b++)m.find(a,d[b],c);return c=this.pushStack(e>1?m.unique(c):c),c.selector=this.selector?this.selector+" "+a:a,c},filter:function(a){return this.pushStack(w(this,a||[],!1))},not:function(a){return this.pushStack(w(this,a||[],!0))},is:function(a){return!!w(this,"string"==typeof a&&t.test(a)?m(a):a||[],!1).length}});var x,y=a.document,z=/^(?:\s*(<[\w\W]+>)[^>]*|#([\w-]*))$/,A=m.fn.init=function(a,b){var c,d;if(!a)return this;if("string"==typeof a){if(c="<"===a.charAt(0)&&">"===a.charAt(a.length-1)&&a.length>=3?[null,a,null]:z.exec(a),!c||!c[1]&&b)return!b||b.jquery?(b||x).find(a):this.constructor(b).find(a);if(c[1]){if(b=b instanceof m?b[0]:b,m.merge(this,m.parseHTML(c[1],b&&b.nodeType?b.ownerDocument||b:y,!0)),u.test(c[1])&&m.isPlainObject(b))for(c in b)m.isFunction(this[c])?this[c](b[c]):this.attr(c,b[c]);return this}if(d=y.getElementById(c[2]),d&&d.parentNode){if(d.id!==c[2])return x.find(a);this.length=1,this[0]=d}return this.context=y,this.selector=a,this}return a.nodeType?(this.context=this[0]=a,this.length=1,this):m.isFunction(a)?"undefined"!=typeof x.ready?x.ready(a):a(m):(void 0!==a.selector&&(this.selector=a.selector,this.context=a.context),m.makeArray(a,this))};A.prototype=m.fn,x=m(y);var B=/^(?:parents|prev(?:Until|All))/,C={children:!0,contents:!0,next:!0,prev:!0};m.extend({dir:function(a,b,c){var d=[],e=a[b];while(e&&9!==e.nodeType&&(void 0===c||1!==e.nodeType||!m(e).is(c)))1===e.nodeType&&d.push(e),e=e[b];return d},sibling:function(a,b){for(var c=[];a;a=a.nextSibling)1===a.nodeType&&a!==b&&c.push(a);return c}}),m.fn.extend({has:function(a){var b,c=m(a,this),d=c.length;return this.filter(function(){for(b=0;d>b;b++)if(m.contains(this,c[b]))return!0})},closest:function(a,b){for(var c,d=0,e=this.length,f=[],g=t.test(a)||"string"!=typeof a?m(a,b||this.context):0;e>d;d++)for(c=this[d];c&&c!==b;c=c.parentNode)if(c.nodeType<11&&(g?g.index(c)>-1:1===c.nodeType&&m.find.matchesSelector(c,a))){f.push(c);break}return this.pushStack(f.length>1?m.unique(f):f)},index:function(a){return a?"string"==typeof a?m.inArray(this[0],m(a)):m.inArray(a.jquery?a[0]:a,this):this[0]&&this[0].parentNode?this.first().prevAll().length:-1},add:function(a,b){return this.pushStack(m.unique(m.merge(this.get(),m(a,b))))},addBack:function(a){return this.add(null==a?this.prevObject:this.prevObject.filter(a))}});function D(a,b){do a=a[b];while(a&&1!==a.nodeType);return a}m.each({parent:function(a){var b=a.parentNode;return b&&11!==b.nodeType?b:null},parents:function(a){return m.dir(a,"parentNode")},parentsUntil:function(a,b,c){return m.dir(a,"parentNode",c)},next:function(a){return D(a,"nextSibling")},prev:function(a){return D(a,"previousSibling")},nextAll:function(a){return m.dir(a,"nextSibling")},prevAll:function(a){return m.dir(a,"previousSibling")},nextUntil:function(a,b,c){return m.dir(a,"nextSibling",c)},prevUntil:function(a,b,c){return m.dir(a,"previousSibling",c)},siblings:function(a){return m.sibling((a.parentNode||{}).firstChild,a)},children:function(a){return m.sibling(a.firstChild)},contents:function(a){return m.nodeName(a,"iframe")?a.contentDocument||a.contentWindow.document:m.merge([],a.childNodes)}},function(a,b){m.fn[a]=function(c,d){var e=m.map(this,b,c);return"Until"!==a.slice(-5)&&(d=c),d&&"string"==typeof d&&(e=m.filter(d,e)),this.length>1&&(C[a]||(e=m.unique(e)),B.test(a)&&(e=e.reverse())),this.pushStack(e)}});var E=/\S+/g,F={};function G(a){var b=F[a]={};return m.each(a.match(E)||[],function(a,c){b[c]=!0}),b}m.Callbacks=function(a){a="string"==typeof a?F[a]||G(a):m.extend({},a);var b,c,d,e,f,g,h=[],i=!a.once&&[],j=function(l){for(c=a.memory&&l,d=!0,f=g||0,g=0,e=h.length,b=!0;h&&e>f;f++)if(h[f].apply(l[0],l[1])===!1&&a.stopOnFalse){c=!1;break}b=!1,h&&(i?i.length&&j(i.shift()):c?h=[]:k.disable())},k={add:function(){if(h){var d=h.length;!function f(b){m.each(b,function(b,c){var d=m.type(c);"function"===d?a.unique&&k.has(c)||h.push(c):c&&c.length&&"string"!==d&&f(c)})}(arguments),b?e=h.length:c&&(g=d,j(c))}return this},remove:function(){return h&&m.each(arguments,function(a,c){var d;while((d=m.inArray(c,h,d))>-1)h.splice(d,1),b&&(e>=d&&e--,f>=d&&f--)}),this},has:function(a){return a?m.inArray(a,h)>-1:!(!h||!h.length)},empty:function(){return h=[],e=0,this},disable:function(){return h=i=c=void 0,this},disabled:function(){return!h},lock:function(){return i=void 0,c||k.disable(),this},locked:function(){return!i},fireWith:function(a,c){return!h||d&&!i||(c=c||[],c=[a,c.slice?c.slice():c],b?i.push(c):j(c)),this},fire:function(){return k.fireWith(this,arguments),this},fired:function(){return!!d}};return k},m.extend({Deferred:function(a){var b=[["resolve","done",m.Callbacks("once memory"),"resolved"],["reject","fail",m.Callbacks("once memory"),"rejected"],["notify","progress",m.Callbacks("memory")]],c="pending",d={state:function(){return c},always:function(){return e.done(arguments).fail(arguments),this},then:function(){var a=arguments;return m.Deferred(function(c){m.each(b,function(b,f){var g=m.isFunction(a[b])&&a[b];e[f[1]](function(){var a=g&&g.apply(this,arguments);a&&m.isFunction(a.promise)?a.promise().done(c.resolve).fail(c.reject).progress(c.notify):c[f[0]+"With"](this===d?c.promise():this,g?[a]:arguments)})}),a=null}).promise()},promise:function(a){return null!=a?m.extend(a,d):d}},e={};return d.pipe=d.then,m.each(b,function(a,f){var g=f[2],h=f[3];d[f[1]]=g.add,h&&g.add(function(){c=h},b[1^a][2].disable,b[2][2].lock),e[f[0]]=function(){return e[f[0]+"With"](this===e?d:this,arguments),this},e[f[0]+"With"]=g.fireWith}),d.promise(e),a&&a.call(e,e),e},when:function(a){var b=0,c=d.call(arguments),e=c.length,f=1!==e||a&&m.isFunction(a.promise)?e:0,g=1===f?a:m.Deferred(),h=function(a,b,c){return function(e){b[a]=this,c[a]=arguments.length>1?d.call(arguments):e,c===i?g.notifyWith(b,c):--f||g.resolveWith(b,c)}},i,j,k;if(e>1)for(i=new Array(e),j=new Array(e),k=new Array(e);e>b;b++)c[b]&&m.isFunction(c[b].promise)?c[b].promise().done(h(b,k,c)).fail(g.reject).progress(h(b,j,i)):--f;return f||g.resolveWith(k,c),g.promise()}});var H;m.fn.ready=function(a){return m.ready.promise().done(a),this},m.extend({isReady:!1,readyWait:1,holdReady:function(a){a?m.readyWait++:m.ready(!0)},ready:function(a){if(a===!0?!--m.readyWait:!m.isReady){if(!y.body)return setTimeout(m.ready);m.isReady=!0,a!==!0&&--m.readyWait>0||(H.resolveWith(y,[m]),m.fn.triggerHandler&&(m(y).triggerHandler("ready"),m(y).off("ready")))}}});function I(){y.addEventListener?(y.removeEventListener("DOMContentLoaded",J,!1),a.removeEventListener("load",J,!1)):(y.detachEvent("onreadystatechange",J),a.detachEvent("onload",J))}function J(){(y.addEventListener||"load"===event.type||"complete"===y.readyState)&&(I(),m.ready())}m.ready.promise=function(b){if(!H)if(H=m.Deferred(),"complete"===y.readyState)setTimeout(m.ready);else if(y.addEventListener)y.addEventListener("DOMContentLoaded",J,!1),a.addEventListener("load",J,!1);else{y.attachEvent("onreadystatechange",J),a.attachEvent("onload",J);var c=!1;try{c=null==a.frameElement&&y.documentElement}catch(d){}c&&c.doScroll&&!function e(){if(!m.isReady){try{c.doScroll("left")}catch(a){return setTimeout(e,50)}I(),m.ready()}}()}return H.promise(b)};var K="undefined",L;for(L in m(k))break;k.ownLast="0"!==L,k.inlineBlockNeedsLayout=!1,m(function(){var a,b,c,d;c=y.getElementsByTagName("body")[0],c&&c.style&&(b=y.createElement("div"),d=y.createElement("div"),d.style.cssText="position:absolute;border:0;width:0;height:0;top:0;left:-9999px",c.appendChild(d).appendChild(b),typeof b.style.zoom!==K&&(b.style.cssText="display:inline;margin:0;border:0;padding:1px;width:1px;zoom:1",k.inlineBlockNeedsLayout=a=3===b.offsetWidth,a&&(c.style.zoom=1)),c.removeChild(d))}),function(){var a=y.createElement("div");if(null==k.deleteExpando){k.deleteExpando=!0;try{delete a.test}catch(b){k.deleteExpando=!1}}a=null}(),m.acceptData=function(a){var b=m.noData[(a.nodeName+" ").toLowerCase()],c=+a.nodeType||1;return 1!==c&&9!==c?!1:!b||b!==!0&&a.getAttribute("classid")===b};var M=/^(?:\{[\w\W]*\}|\[[\w\W]*\])$/,N=/([A-Z])/g;function O(a,b,c){if(void 0===c&&1===a.nodeType){var d="data-"+b.replace(N,"-$1").toLowerCase();if(c=a.getAttribute(d),"string"==typeof c){try{c="true"===c?!0:"false"===c?!1:"null"===c?null:+c+""===c?+c:M.test(c)?m.parseJSON(c):c}catch(e){}m.data(a,b,c)}else c=void 0}return c}function P(a){var b;for(b in a)if(("data"!==b||!m.isEmptyObject(a[b]))&&"toJSON"!==b)return!1;return!0}function Q(a,b,d,e){if(m.acceptData(a)){var f,g,h=m.expando,i=a.nodeType,j=i?m.cache:a,k=i?a[h]:a[h]&&h;
if(k&&j[k]&&(e||j[k].data)||void 0!==d||"string"!=typeof b)return k||(k=i?a[h]=c.pop()||m.guid++:h),j[k]||(j[k]=i?{}:{toJSON:m.noop}),("object"==typeof b||"function"==typeof b)&&(e?j[k]=m.extend(j[k],b):j[k].data=m.extend(j[k].data,b)),g=j[k],e||(g.data||(g.data={}),g=g.data),void 0!==d&&(g[m.camelCase(b)]=d),"string"==typeof b?(f=g[b],null==f&&(f=g[m.camelCase(b)])):f=g,f}}function R(a,b,c){if(m.acceptData(a)){var d,e,f=a.nodeType,g=f?m.cache:a,h=f?a[m.expando]:m.expando;if(g[h]){if(b&&(d=c?g[h]:g[h].data)){m.isArray(b)?b=b.concat(m.map(b,m.camelCase)):b in d?b=[b]:(b=m.camelCase(b),b=b in d?[b]:b.split(" ")),e=b.length;while(e--)delete d[b[e]];if(c?!P(d):!m.isEmptyObject(d))return}(c||(delete g[h].data,P(g[h])))&&(f?m.cleanData([a],!0):k.deleteExpando||g!=g.window?delete g[h]:g[h]=null)}}}m.extend({cache:{},noData:{"applet ":!0,"embed ":!0,"object ":"clsid:D27CDB6E-AE6D-11cf-96B8-444553540000"},hasData:function(a){return a=a.nodeType?m.cache[a[m.expando]]:a[m.expando],!!a&&!P(a)},data:function(a,b,c){return Q(a,b,c)},removeData:function(a,b){return R(a,b)},_data:function(a,b,c){return Q(a,b,c,!0)},_removeData:function(a,b){return R(a,b,!0)}}),m.fn.extend({data:function(a,b){var c,d,e,f=this[0],g=f&&f.attributes;if(void 0===a){if(this.length&&(e=m.data(f),1===f.nodeType&&!m._data(f,"parsedAttrs"))){c=g.length;while(c--)g[c]&&(d=g[c].name,0===d.indexOf("data-")&&(d=m.camelCase(d.slice(5)),O(f,d,e[d])));m._data(f,"parsedAttrs",!0)}return e}return"object"==typeof a?this.each(function(){m.data(this,a)}):arguments.length>1?this.each(function(){m.data(this,a,b)}):f?O(f,a,m.data(f,a)):void 0},removeData:function(a){return this.each(function(){m.removeData(this,a)})}}),m.extend({queue:function(a,b,c){var d;return a?(b=(b||"fx")+"queue",d=m._data(a,b),c&&(!d||m.isArray(c)?d=m._data(a,b,m.makeArray(c)):d.push(c)),d||[]):void 0},dequeue:function(a,b){b=b||"fx";var c=m.queue(a,b),d=c.length,e=c.shift(),f=m._queueHooks(a,b),g=function(){m.dequeue(a,b)};"inprogress"===e&&(e=c.shift(),d--),e&&("fx"===b&&c.unshift("inprogress"),delete f.stop,e.call(a,g,f)),!d&&f&&f.empty.fire()},_queueHooks:function(a,b){var c=b+"queueHooks";return m._data(a,c)||m._data(a,c,{empty:m.Callbacks("once memory").add(function(){m._removeData(a,b+"queue"),m._removeData(a,c)})})}}),m.fn.extend({queue:function(a,b){var c=2;return"string"!=typeof a&&(b=a,a="fx",c--),arguments.length<c?m.queue(this[0],a):void 0===b?this:this.each(function(){var c=m.queue(this,a,b);m._queueHooks(this,a),"fx"===a&&"inprogress"!==c[0]&&m.dequeue(this,a)})},dequeue:function(a){return this.each(function(){m.dequeue(this,a)})},clearQueue:function(a){return this.queue(a||"fx",[])},promise:function(a,b){var c,d=1,e=m.Deferred(),f=this,g=this.length,h=function(){--d||e.resolveWith(f,[f])};"string"!=typeof a&&(b=a,a=void 0),a=a||"fx";while(g--)c=m._data(f[g],a+"queueHooks"),c&&c.empty&&(d++,c.empty.add(h));return h(),e.promise(b)}});var S=/[+-]?(?:\d*\.|)\d+(?:[eE][+-]?\d+|)/.source,T=["Top","Right","Bottom","Left"],U=function(a,b){return a=b||a,"none"===m.css(a,"display")||!m.contains(a.ownerDocument,a)},V=m.access=function(a,b,c,d,e,f,g){var h=0,i=a.length,j=null==c;if("object"===m.type(c)){e=!0;for(h in c)m.access(a,b,h,c[h],!0,f,g)}else if(void 0!==d&&(e=!0,m.isFunction(d)||(g=!0),j&&(g?(b.call(a,d),b=null):(j=b,b=function(a,b,c){return j.call(m(a),c)})),b))for(;i>h;h++)b(a[h],c,g?d:d.call(a[h],h,b(a[h],c)));return e?a:j?b.call(a):i?b(a[0],c):f},W=/^(?:checkbox|radio)$/i;!function(){var a=y.createElement("input"),b=y.createElement("div"),c=y.createDocumentFragment();if(b.innerHTML="  <link/><table></table><a href='/a'>a</a><input type='checkbox'/>",k.leadingWhitespace=3===b.firstChild.nodeType,k.tbody=!b.getElementsByTagName("tbody").length,k.htmlSerialize=!!b.getElementsByTagName("link").length,k.html5Clone="<:nav></:nav>"!==y.createElement("nav").cloneNode(!0).outerHTML,a.type="checkbox",a.checked=!0,c.appendChild(a),k.appendChecked=a.checked,b.innerHTML="<textarea>x</textarea>",k.noCloneChecked=!!b.cloneNode(!0).lastChild.defaultValue,c.appendChild(b),b.innerHTML="<input type='radio' checked='checked' name='t'/>",k.checkClone=b.cloneNode(!0).cloneNode(!0).lastChild.checked,k.noCloneEvent=!0,b.attachEvent&&(b.attachEvent("onclick",function(){k.noCloneEvent=!1}),b.cloneNode(!0).click()),null==k.deleteExpando){k.deleteExpando=!0;try{delete b.test}catch(d){k.deleteExpando=!1}}}(),function(){var b,c,d=y.createElement("div");for(b in{submit:!0,change:!0,focusin:!0})c="on"+b,(k[b+"Bubbles"]=c in a)||(d.setAttribute(c,"t"),k[b+"Bubbles"]=d.attributes[c].expando===!1);d=null}();var X=/^(?:input|select|textarea)$/i,Y=/^key/,Z=/^(?:mouse|pointer|contextmenu)|click/,$=/^(?:focusinfocus|focusoutblur)$/,_=/^([^.]*)(?:\.(.+)|)$/;function ab(){return!0}function bb(){return!1}function cb(){try{return y.activeElement}catch(a){}}m.event={global:{},add:function(a,b,c,d,e){var f,g,h,i,j,k,l,n,o,p,q,r=m._data(a);if(r){c.handler&&(i=c,c=i.handler,e=i.selector),c.guid||(c.guid=m.guid++),(g=r.events)||(g=r.events={}),(k=r.handle)||(k=r.handle=function(a){return typeof m===K||a&&m.event.triggered===a.type?void 0:m.event.dispatch.apply(k.elem,arguments)},k.elem=a),b=(b||"").match(E)||[""],h=b.length;while(h--)f=_.exec(b[h])||[],o=q=f[1],p=(f[2]||"").split(".").sort(),o&&(j=m.event.special[o]||{},o=(e?j.delegateType:j.bindType)||o,j=m.event.special[o]||{},l=m.extend({type:o,origType:q,data:d,handler:c,guid:c.guid,selector:e,needsContext:e&&m.expr.match.needsContext.test(e),namespace:p.join(".")},i),(n=g[o])||(n=g[o]=[],n.delegateCount=0,j.setup&&j.setup.call(a,d,p,k)!==!1||(a.addEventListener?a.addEventListener(o,k,!1):a.attachEvent&&a.attachEvent("on"+o,k))),j.add&&(j.add.call(a,l),l.handler.guid||(l.handler.guid=c.guid)),e?n.splice(n.delegateCount++,0,l):n.push(l),m.event.global[o]=!0);a=null}},remove:function(a,b,c,d,e){var f,g,h,i,j,k,l,n,o,p,q,r=m.hasData(a)&&m._data(a);if(r&&(k=r.events)){b=(b||"").match(E)||[""],j=b.length;while(j--)if(h=_.exec(b[j])||[],o=q=h[1],p=(h[2]||"").split(".").sort(),o){l=m.event.special[o]||{},o=(d?l.delegateType:l.bindType)||o,n=k[o]||[],h=h[2]&&new RegExp("(^|\\.)"+p.join("\\.(?:.*\\.|)")+"(\\.|$)"),i=f=n.length;while(f--)g=n[f],!e&&q!==g.origType||c&&c.guid!==g.guid||h&&!h.test(g.namespace)||d&&d!==g.selector&&("**"!==d||!g.selector)||(n.splice(f,1),g.selector&&n.delegateCount--,l.remove&&l.remove.call(a,g));i&&!n.length&&(l.teardown&&l.teardown.call(a,p,r.handle)!==!1||m.removeEvent(a,o,r.handle),delete k[o])}else for(o in k)m.event.remove(a,o+b[j],c,d,!0);m.isEmptyObject(k)&&(delete r.handle,m._removeData(a,"events"))}},trigger:function(b,c,d,e){var f,g,h,i,k,l,n,o=[d||y],p=j.call(b,"type")?b.type:b,q=j.call(b,"namespace")?b.namespace.split("."):[];if(h=l=d=d||y,3!==d.nodeType&&8!==d.nodeType&&!$.test(p+m.event.triggered)&&(p.indexOf(".")>=0&&(q=p.split("."),p=q.shift(),q.sort()),g=p.indexOf(":")<0&&"on"+p,b=b[m.expando]?b:new m.Event(p,"object"==typeof b&&b),b.isTrigger=e?2:3,b.namespace=q.join("."),b.namespace_re=b.namespace?new RegExp("(^|\\.)"+q.join("\\.(?:.*\\.|)")+"(\\.|$)"):null,b.result=void 0,b.target||(b.target=d),c=null==c?[b]:m.makeArray(c,[b]),k=m.event.special[p]||{},e||!k.trigger||k.trigger.apply(d,c)!==!1)){if(!e&&!k.noBubble&&!m.isWindow(d)){for(i=k.delegateType||p,$.test(i+p)||(h=h.parentNode);h;h=h.parentNode)o.push(h),l=h;l===(d.ownerDocument||y)&&o.push(l.defaultView||l.parentWindow||a)}n=0;while((h=o[n++])&&!b.isPropagationStopped())b.type=n>1?i:k.bindType||p,f=(m._data(h,"events")||{})[b.type]&&m._data(h,"handle"),f&&f.apply(h,c),f=g&&h[g],f&&f.apply&&m.acceptData(h)&&(b.result=f.apply(h,c),b.result===!1&&b.preventDefault());if(b.type=p,!e&&!b.isDefaultPrevented()&&(!k._default||k._default.apply(o.pop(),c)===!1)&&m.acceptData(d)&&g&&d[p]&&!m.isWindow(d)){l=d[g],l&&(d[g]=null),m.event.triggered=p;try{d[p]()}catch(r){}m.event.triggered=void 0,l&&(d[g]=l)}return b.result}},dispatch:function(a){a=m.event.fix(a);var b,c,e,f,g,h=[],i=d.call(arguments),j=(m._data(this,"events")||{})[a.type]||[],k=m.event.special[a.type]||{};if(i[0]=a,a.delegateTarget=this,!k.preDispatch||k.preDispatch.call(this,a)!==!1){h=m.event.handlers.call(this,a,j),b=0;while((f=h[b++])&&!a.isPropagationStopped()){a.currentTarget=f.elem,g=0;while((e=f.handlers[g++])&&!a.isImmediatePropagationStopped())(!a.namespace_re||a.namespace_re.test(e.namespace))&&(a.handleObj=e,a.data=e.data,c=((m.event.special[e.origType]||{}).handle||e.handler).apply(f.elem,i),void 0!==c&&(a.result=c)===!1&&(a.preventDefault(),a.stopPropagation()))}return k.postDispatch&&k.postDispatch.call(this,a),a.result}},handlers:function(a,b){var c,d,e,f,g=[],h=b.delegateCount,i=a.target;if(h&&i.nodeType&&(!a.button||"click"!==a.type))for(;i!=this;i=i.parentNode||this)if(1===i.nodeType&&(i.disabled!==!0||"click"!==a.type)){for(e=[],f=0;h>f;f++)d=b[f],c=d.selector+" ",void 0===e[c]&&(e[c]=d.needsContext?m(c,this).index(i)>=0:m.find(c,this,null,[i]).length),e[c]&&e.push(d);e.length&&g.push({elem:i,handlers:e})}return h<b.length&&g.push({elem:this,handlers:b.slice(h)}),g},fix:function(a){if(a[m.expando])return a;var b,c,d,e=a.type,f=a,g=this.fixHooks[e];g||(this.fixHooks[e]=g=Z.test(e)?this.mouseHooks:Y.test(e)?this.keyHooks:{}),d=g.props?this.props.concat(g.props):this.props,a=new m.Event(f),b=d.length;while(b--)c=d[b],a[c]=f[c];return a.target||(a.target=f.srcElement||y),3===a.target.nodeType&&(a.target=a.target.parentNode),a.metaKey=!!a.metaKey,g.filter?g.filter(a,f):a},props:"altKey bubbles cancelable ctrlKey currentTarget eventPhase metaKey relatedTarget shiftKey target timeStamp view which".split(" "),fixHooks:{},keyHooks:{props:"char charCode key keyCode".split(" "),filter:function(a,b){return null==a.which&&(a.which=null!=b.charCode?b.charCode:b.keyCode),a}},mouseHooks:{props:"button buttons clientX clientY fromElement offsetX offsetY pageX pageY screenX screenY toElement".split(" "),filter:function(a,b){var c,d,e,f=b.button,g=b.fromElement;return null==a.pageX&&null!=b.clientX&&(d=a.target.ownerDocument||y,e=d.documentElement,c=d.body,a.pageX=b.clientX+(e&&e.scrollLeft||c&&c.scrollLeft||0)-(e&&e.clientLeft||c&&c.clientLeft||0),a.pageY=b.clientY+(e&&e.scrollTop||c&&c.scrollTop||0)-(e&&e.clientTop||c&&c.clientTop||0)),!a.relatedTarget&&g&&(a.relatedTarget=g===a.target?b.toElement:g),a.which||void 0===f||(a.which=1&f?1:2&f?3:4&f?2:0),a}},special:{load:{noBubble:!0},focus:{trigger:function(){if(this!==cb()&&this.focus)try{return this.focus(),!1}catch(a){}},delegateType:"focusin"},blur:{trigger:function(){return this===cb()&&this.blur?(this.blur(),!1):void 0},delegateType:"focusout"},click:{trigger:function(){return m.nodeName(this,"input")&&"checkbox"===this.type&&this.click?(this.click(),!1):void 0},_default:function(a){return m.nodeName(a.target,"a")}},beforeunload:{postDispatch:function(a){void 0!==a.result&&a.originalEvent&&(a.originalEvent.returnValue=a.result)}}},simulate:function(a,b,c,d){var e=m.extend(new m.Event,c,{type:a,isSimulated:!0,originalEvent:{}});d?m.event.trigger(e,null,b):m.event.dispatch.call(b,e),e.isDefaultPrevented()&&c.preventDefault()}},m.removeEvent=y.removeEventListener?function(a,b,c){a.removeEventListener&&a.removeEventListener(b,c,!1)}:function(a,b,c){var d="on"+b;a.detachEvent&&(typeof a[d]===K&&(a[d]=null),a.detachEvent(d,c))},m.Event=function(a,b){return this instanceof m.Event?(a&&a.type?(this.originalEvent=a,this.type=a.type,this.isDefaultPrevented=a.defaultPrevented||void 0===a.defaultPrevented&&a.returnValue===!1?ab:bb):this.type=a,b&&m.extend(this,b),this.timeStamp=a&&a.timeStamp||m.now(),void(this[m.expando]=!0)):new m.Event(a,b)},m.Event.prototype={isDefaultPrevented:bb,isPropagationStopped:bb,isImmediatePropagationStopped:bb,preventDefault:function(){var a=this.originalEvent;this.isDefaultPrevented=ab,a&&(a.preventDefault?a.preventDefault():a.returnValue=!1)},stopPropagation:function(){var a=this.originalEvent;this.isPropagationStopped=ab,a&&(a.stopPropagation&&a.stopPropagation(),a.cancelBubble=!0)},stopImmediatePropagation:function(){var a=this.originalEvent;this.isImmediatePropagationStopped=ab,a&&a.stopImmediatePropagation&&a.stopImmediatePropagation(),this.stopPropagation()}},m.each({mouseenter:"mouseover",mouseleave:"mouseout",pointerenter:"pointerover",pointerleave:"pointerout"},function(a,b){m.event.special[a]={delegateType:b,bindType:b,handle:function(a){var c,d=this,e=a.relatedTarget,f=a.handleObj;return(!e||e!==d&&!m.contains(d,e))&&(a.type=f.origType,c=f.handler.apply(this,arguments),a.type=b),c}}}),k.submitBubbles||(m.event.special.submit={setup:function(){return m.nodeName(this,"form")?!1:void m.event.add(this,"click._submit keypress._submit",function(a){var b=a.target,c=m.nodeName(b,"input")||m.nodeName(b,"button")?b.form:void 0;c&&!m._data(c,"submitBubbles")&&(m.event.add(c,"submit._submit",function(a){a._submit_bubble=!0}),m._data(c,"submitBubbles",!0))})},postDispatch:function(a){a._submit_bubble&&(delete a._submit_bubble,this.parentNode&&!a.isTrigger&&m.event.simulate("submit",this.parentNode,a,!0))},teardown:function(){return m.nodeName(this,"form")?!1:void m.event.remove(this,"._submit")}}),k.changeBubbles||(m.event.special.change={setup:function(){return X.test(this.nodeName)?(("checkbox"===this.type||"radio"===this.type)&&(m.event.add(this,"propertychange._change",function(a){"checked"===a.originalEvent.propertyName&&(this._just_changed=!0)}),m.event.add(this,"click._change",function(a){this._just_changed&&!a.isTrigger&&(this._just_changed=!1),m.event.simulate("change",this,a,!0)})),!1):void m.event.add(this,"beforeactivate._change",function(a){var b=a.target;X.test(b.nodeName)&&!m._data(b,"changeBubbles")&&(m.event.add(b,"change._change",function(a){!this.parentNode||a.isSimulated||a.isTrigger||m.event.simulate("change",this.parentNode,a,!0)}),m._data(b,"changeBubbles",!0))})},handle:function(a){var b=a.target;return this!==b||a.isSimulated||a.isTrigger||"radio"!==b.type&&"checkbox"!==b.type?a.handleObj.handler.apply(this,arguments):void 0},teardown:function(){return m.event.remove(this,"._change"),!X.test(this.nodeName)}}),k.focusinBubbles||m.each({focus:"focusin",blur:"focusout"},function(a,b){var c=function(a){m.event.simulate(b,a.target,m.event.fix(a),!0)};m.event.special[b]={setup:function(){var d=this.ownerDocument||this,e=m._data(d,b);e||d.addEventListener(a,c,!0),m._data(d,b,(e||0)+1)},teardown:function(){var d=this.ownerDocument||this,e=m._data(d,b)-1;e?m._data(d,b,e):(d.removeEventListener(a,c,!0),m._removeData(d,b))}}}),m.fn.extend({on:function(a,b,c,d,e){var f,g;if("object"==typeof a){"string"!=typeof b&&(c=c||b,b=void 0);for(f in a)this.on(f,b,c,a[f],e);return this}if(null==c&&null==d?(d=b,c=b=void 0):null==d&&("string"==typeof b?(d=c,c=void 0):(d=c,c=b,b=void 0)),d===!1)d=bb;else if(!d)return this;return 1===e&&(g=d,d=function(a){return m().off(a),g.apply(this,arguments)},d.guid=g.guid||(g.guid=m.guid++)),this.each(function(){m.event.add(this,a,d,c,b)})},one:function(a,b,c,d){return this.on(a,b,c,d,1)},off:function(a,b,c){var d,e;if(a&&a.preventDefault&&a.handleObj)return d=a.handleObj,m(a.delegateTarget).off(d.namespace?d.origType+"."+d.namespace:d.origType,d.selector,d.handler),this;if("object"==typeof a){for(e in a)this.off(e,b,a[e]);return this}return(b===!1||"function"==typeof b)&&(c=b,b=void 0),c===!1&&(c=bb),this.each(function(){m.event.remove(this,a,c,b)})},trigger:function(a,b){return this.each(function(){m.event.trigger(a,b,this)})},triggerHandler:function(a,b){var c=this[0];return c?m.event.trigger(a,b,c,!0):void 0}});function db(a){var b=eb.split("|"),c=a.createDocumentFragment();if(c.createElement)while(b.length)c.createElement(b.pop());return c}var eb="abbr|article|aside|audio|bdi|canvas|data|datalist|details|figcaption|figure|footer|header|hgroup|mark|meter|nav|output|progress|section|summary|time|video",fb=/ jQuery\d+="(?:null|\d+)"/g,gb=new RegExp("<(?:"+eb+")[\\s/>]","i"),hb=/^\s+/,ib=/<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/gi,jb=/<([\w:]+)/,kb=/<tbody/i,lb=/<|&#?\w+;/,mb=/<(?:script|style|link)/i,nb=/checked\s*(?:[^=]|=\s*.checked.)/i,ob=/^$|\/(?:java|ecma)script/i,pb=/^true\/(.*)/,qb=/^\s*<!(?:\[CDATA\[|--)|(?:\]\]|--)>\s*$/g,rb={option:[1,"<select multiple='multiple'>","</select>"],legend:[1,"<fieldset>","</fieldset>"],area:[1,"<map>","</map>"],param:[1,"<object>","</object>"],thead:[1,"<table>","</table>"],tr:[2,"<table><tbody>","</tbody></table>"],col:[2,"<table><tbody></tbody><colgroup>","</colgroup></table>"],td:[3,"<table><tbody><tr>","</tr></tbody></table>"],_default:k.htmlSerialize?[0,"",""]:[1,"X<div>","</div>"]},sb=db(y),tb=sb.appendChild(y.createElement("div"));rb.optgroup=rb.option,rb.tbody=rb.tfoot=rb.colgroup=rb.caption=rb.thead,rb.th=rb.td;function ub(a,b){var c,d,e=0,f=typeof a.getElementsByTagName!==K?a.getElementsByTagName(b||"*"):typeof a.querySelectorAll!==K?a.querySelectorAll(b||"*"):void 0;if(!f)for(f=[],c=a.childNodes||a;null!=(d=c[e]);e++)!b||m.nodeName(d,b)?f.push(d):m.merge(f,ub(d,b));return void 0===b||b&&m.nodeName(a,b)?m.merge([a],f):f}function vb(a){W.test(a.type)&&(a.defaultChecked=a.checked)}function wb(a,b){return m.nodeName(a,"table")&&m.nodeName(11!==b.nodeType?b:b.firstChild,"tr")?a.getElementsByTagName("tbody")[0]||a.appendChild(a.ownerDocument.createElement("tbody")):a}function xb(a){return a.type=(null!==m.find.attr(a,"type"))+"/"+a.type,a}function yb(a){var b=pb.exec(a.type);return b?a.type=b[1]:a.removeAttribute("type"),a}function zb(a,b){for(var c,d=0;null!=(c=a[d]);d++)m._data(c,"globalEval",!b||m._data(b[d],"globalEval"))}function Ab(a,b){if(1===b.nodeType&&m.hasData(a)){var c,d,e,f=m._data(a),g=m._data(b,f),h=f.events;if(h){delete g.handle,g.events={};for(c in h)for(d=0,e=h[c].length;e>d;d++)m.event.add(b,c,h[c][d])}g.data&&(g.data=m.extend({},g.data))}}function Bb(a,b){var c,d,e;if(1===b.nodeType){if(c=b.nodeName.toLowerCase(),!k.noCloneEvent&&b[m.expando]){e=m._data(b);for(d in e.events)m.removeEvent(b,d,e.handle);b.removeAttribute(m.expando)}"script"===c&&b.text!==a.text?(xb(b).text=a.text,yb(b)):"object"===c?(b.parentNode&&(b.outerHTML=a.outerHTML),k.html5Clone&&a.innerHTML&&!m.trim(b.innerHTML)&&(b.innerHTML=a.innerHTML)):"input"===c&&W.test(a.type)?(b.defaultChecked=b.checked=a.checked,b.value!==a.value&&(b.value=a.value)):"option"===c?b.defaultSelected=b.selected=a.defaultSelected:("input"===c||"textarea"===c)&&(b.defaultValue=a.defaultValue)}}m.extend({clone:function(a,b,c){var d,e,f,g,h,i=m.contains(a.ownerDocument,a);if(k.html5Clone||m.isXMLDoc(a)||!gb.test("<"+a.nodeName+">")?f=a.cloneNode(!0):(tb.innerHTML=a.outerHTML,tb.removeChild(f=tb.firstChild)),!(k.noCloneEvent&&k.noCloneChecked||1!==a.nodeType&&11!==a.nodeType||m.isXMLDoc(a)))for(d=ub(f),h=ub(a),g=0;null!=(e=h[g]);++g)d[g]&&Bb(e,d[g]);if(b)if(c)for(h=h||ub(a),d=d||ub(f),g=0;null!=(e=h[g]);g++)Ab(e,d[g]);else Ab(a,f);return d=ub(f,"script"),d.length>0&&zb(d,!i&&ub(a,"script")),d=h=e=null,f},buildFragment:function(a,b,c,d){for(var e,f,g,h,i,j,l,n=a.length,o=db(b),p=[],q=0;n>q;q++)if(f=a[q],f||0===f)if("object"===m.type(f))m.merge(p,f.nodeType?[f]:f);else if(lb.test(f)){h=h||o.appendChild(b.createElement("div")),i=(jb.exec(f)||["",""])[1].toLowerCase(),l=rb[i]||rb._default,h.innerHTML=l[1]+f.replace(ib,"<$1></$2>")+l[2],e=l[0];while(e--)h=h.lastChild;if(!k.leadingWhitespace&&hb.test(f)&&p.push(b.createTextNode(hb.exec(f)[0])),!k.tbody){f="table"!==i||kb.test(f)?"<table>"!==l[1]||kb.test(f)?0:h:h.firstChild,e=f&&f.childNodes.length;while(e--)m.nodeName(j=f.childNodes[e],"tbody")&&!j.childNodes.length&&f.removeChild(j)}m.merge(p,h.childNodes),h.textContent="";while(h.firstChild)h.removeChild(h.firstChild);h=o.lastChild}else p.push(b.createTextNode(f));h&&o.removeChild(h),k.appendChecked||m.grep(ub(p,"input"),vb),q=0;while(f=p[q++])if((!d||-1===m.inArray(f,d))&&(g=m.contains(f.ownerDocument,f),h=ub(o.appendChild(f),"script"),g&&zb(h),c)){e=0;while(f=h[e++])ob.test(f.type||"")&&c.push(f)}return h=null,o},cleanData:function(a,b){for(var d,e,f,g,h=0,i=m.expando,j=m.cache,l=k.deleteExpando,n=m.event.special;null!=(d=a[h]);h++)if((b||m.acceptData(d))&&(f=d[i],g=f&&j[f])){if(g.events)for(e in g.events)n[e]?m.event.remove(d,e):m.removeEvent(d,e,g.handle);j[f]&&(delete j[f],l?delete d[i]:typeof d.removeAttribute!==K?d.removeAttribute(i):d[i]=null,c.push(f))}}}),m.fn.extend({text:function(a){return V(this,function(a){return void 0===a?m.text(this):this.empty().append((this[0]&&this[0].ownerDocument||y).createTextNode(a))},null,a,arguments.length)},append:function(){return this.domManip(arguments,function(a){if(1===this.nodeType||11===this.nodeType||9===this.nodeType){var b=wb(this,a);b.appendChild(a)}})},prepend:function(){return this.domManip(arguments,function(a){if(1===this.nodeType||11===this.nodeType||9===this.nodeType){var b=wb(this,a);b.insertBefore(a,b.firstChild)}})},before:function(){return this.domManip(arguments,function(a){this.parentNode&&this.parentNode.insertBefore(a,this)})},after:function(){return this.domManip(arguments,function(a){this.parentNode&&this.parentNode.insertBefore(a,this.nextSibling)})},remove:function(a,b){for(var c,d=a?m.filter(a,this):this,e=0;null!=(c=d[e]);e++)b||1!==c.nodeType||m.cleanData(ub(c)),c.parentNode&&(b&&m.contains(c.ownerDocument,c)&&zb(ub(c,"script")),c.parentNode.removeChild(c));return this},empty:function(){for(var a,b=0;null!=(a=this[b]);b++){1===a.nodeType&&m.cleanData(ub(a,!1));while(a.firstChild)a.removeChild(a.firstChild);a.options&&m.nodeName(a,"select")&&(a.options.length=0)}return this},clone:function(a,b){return a=null==a?!1:a,b=null==b?a:b,this.map(function(){return m.clone(this,a,b)})},html:function(a){return V(this,function(a){var b=this[0]||{},c=0,d=this.length;if(void 0===a)return 1===b.nodeType?b.innerHTML.replace(fb,""):void 0;if(!("string"!=typeof a||mb.test(a)||!k.htmlSerialize&&gb.test(a)||!k.leadingWhitespace&&hb.test(a)||rb[(jb.exec(a)||["",""])[1].toLowerCase()])){a=a.replace(ib,"<$1></$2>");try{for(;d>c;c++)b=this[c]||{},1===b.nodeType&&(m.cleanData(ub(b,!1)),b.innerHTML=a);b=0}catch(e){}}b&&this.empty().append(a)},null,a,arguments.length)},replaceWith:function(){var a=arguments[0];return this.domManip(arguments,function(b){a=this.parentNode,m.cleanData(ub(this)),a&&a.replaceChild(b,this)}),a&&(a.length||a.nodeType)?this:this.remove()},detach:function(a){return this.remove(a,!0)},domManip:function(a,b){a=e.apply([],a);var c,d,f,g,h,i,j=0,l=this.length,n=this,o=l-1,p=a[0],q=m.isFunction(p);if(q||l>1&&"string"==typeof p&&!k.checkClone&&nb.test(p))return this.each(function(c){var d=n.eq(c);q&&(a[0]=p.call(this,c,d.html())),d.domManip(a,b)});if(l&&(i=m.buildFragment(a,this[0].ownerDocument,!1,this),c=i.firstChild,1===i.childNodes.length&&(i=c),c)){for(g=m.map(ub(i,"script"),xb),f=g.length;l>j;j++)d=i,j!==o&&(d=m.clone(d,!0,!0),f&&m.merge(g,ub(d,"script"))),b.call(this[j],d,j);if(f)for(h=g[g.length-1].ownerDocument,m.map(g,yb),j=0;f>j;j++)d=g[j],ob.test(d.type||"")&&!m._data(d,"globalEval")&&m.contains(h,d)&&(d.src?m._evalUrl&&m._evalUrl(d.src):m.globalEval((d.text||d.textContent||d.innerHTML||"").replace(qb,"")));i=c=null}return this}}),m.each({appendTo:"append",prependTo:"prepend",insertBefore:"before",insertAfter:"after",replaceAll:"replaceWith"},function(a,b){m.fn[a]=function(a){for(var c,d=0,e=[],g=m(a),h=g.length-1;h>=d;d++)c=d===h?this:this.clone(!0),m(g[d])[b](c),f.apply(e,c.get());return this.pushStack(e)}});var Cb,Db={};function Eb(b,c){var d,e=m(c.createElement(b)).appendTo(c.body),f=a.getDefaultComputedStyle&&(d=a.getDefaultComputedStyle(e[0]))?d.display:m.css(e[0],"display");return e.detach(),f}function Fb(a){var b=y,c=Db[a];return c||(c=Eb(a,b),"none"!==c&&c||(Cb=(Cb||m("<iframe frameborder='0' width='0' height='0'/>")).appendTo(b.documentElement),b=(Cb[0].contentWindow||Cb[0].contentDocument).document,b.write(),b.close(),c=Eb(a,b),Cb.detach()),Db[a]=c),c}!function(){var a;k.shrinkWrapBlocks=function(){if(null!=a)return a;a=!1;var b,c,d;return c=y.getElementsByTagName("body")[0],c&&c.style?(b=y.createElement("div"),d=y.createElement("div"),d.style.cssText="position:absolute;border:0;width:0;height:0;top:0;left:-9999px",c.appendChild(d).appendChild(b),typeof b.style.zoom!==K&&(b.style.cssText="-webkit-box-sizing:content-box;-moz-box-sizing:content-box;box-sizing:content-box;display:block;margin:0;border:0;padding:1px;width:1px;zoom:1",b.appendChild(y.createElement("div")).style.width="5px",a=3!==b.offsetWidth),c.removeChild(d),a):void 0}}();var Gb=/^margin/,Hb=new RegExp("^("+S+")(?!px)[a-z%]+$","i"),Ib,Jb,Kb=/^(top|right|bottom|left)$/;a.getComputedStyle?(Ib=function(a){return a.ownerDocument.defaultView.getComputedStyle(a,null)},Jb=function(a,b,c){var d,e,f,g,h=a.style;return c=c||Ib(a),g=c?c.getPropertyValue(b)||c[b]:void 0,c&&(""!==g||m.contains(a.ownerDocument,a)||(g=m.style(a,b)),Hb.test(g)&&Gb.test(b)&&(d=h.width,e=h.minWidth,f=h.maxWidth,h.minWidth=h.maxWidth=h.width=g,g=c.width,h.width=d,h.minWidth=e,h.maxWidth=f)),void 0===g?g:g+""}):y.documentElement.currentStyle&&(Ib=function(a){return a.currentStyle},Jb=function(a,b,c){var d,e,f,g,h=a.style;return c=c||Ib(a),g=c?c[b]:void 0,null==g&&h&&h[b]&&(g=h[b]),Hb.test(g)&&!Kb.test(b)&&(d=h.left,e=a.runtimeStyle,f=e&&e.left,f&&(e.left=a.currentStyle.left),h.left="fontSize"===b?"1em":g,g=h.pixelLeft+"px",h.left=d,f&&(e.left=f)),void 0===g?g:g+""||"auto"});function Lb(a,b){return{get:function(){var c=a();if(null!=c)return c?void delete this.get:(this.get=b).apply(this,arguments)}}}!function(){var b,c,d,e,f,g,h;if(b=y.createElement("div"),b.innerHTML="  <link/><table></table><a href='/a'>a</a><input type='checkbox'/>",d=b.getElementsByTagName("a")[0],c=d&&d.style){c.cssText="float:left;opacity:.5",k.opacity="0.5"===c.opacity,k.cssFloat=!!c.cssFloat,b.style.backgroundClip="content-box",b.cloneNode(!0).style.backgroundClip="",k.clearCloneStyle="content-box"===b.style.backgroundClip,k.boxSizing=""===c.boxSizing||""===c.MozBoxSizing||""===c.WebkitBoxSizing,m.extend(k,{reliableHiddenOffsets:function(){return null==g&&i(),g},boxSizingReliable:function(){return null==f&&i(),f},pixelPosition:function(){return null==e&&i(),e},reliableMarginRight:function(){return null==h&&i(),h}});function i(){var b,c,d,i;c=y.getElementsByTagName("body")[0],c&&c.style&&(b=y.createElement("div"),d=y.createElement("div"),d.style.cssText="position:absolute;border:0;width:0;height:0;top:0;left:-9999px",c.appendChild(d).appendChild(b),b.style.cssText="-webkit-box-sizing:border-box;-moz-box-sizing:border-box;box-sizing:border-box;display:block;margin-top:1%;top:1%;border:1px;padding:1px;width:4px;position:absolute",e=f=!1,h=!0,a.getComputedStyle&&(e="1%"!==(a.getComputedStyle(b,null)||{}).top,f="4px"===(a.getComputedStyle(b,null)||{width:"4px"}).width,i=b.appendChild(y.createElement("div")),i.style.cssText=b.style.cssText="-webkit-box-sizing:content-box;-moz-box-sizing:content-box;box-sizing:content-box;display:block;margin:0;border:0;padding:0",i.style.marginRight=i.style.width="0",b.style.width="1px",h=!parseFloat((a.getComputedStyle(i,null)||{}).marginRight)),b.innerHTML="<table><tr><td></td><td>t</td></tr></table>",i=b.getElementsByTagName("td"),i[0].style.cssText="margin:0;border:0;padding:0;display:none",g=0===i[0].offsetHeight,g&&(i[0].style.display="",i[1].style.display="none",g=0===i[0].offsetHeight),c.removeChild(d))}}}(),m.swap=function(a,b,c,d){var e,f,g={};for(f in b)g[f]=a.style[f],a.style[f]=b[f];e=c.apply(a,d||[]);for(f in b)a.style[f]=g[f];return e};var Mb=/alpha\([^)]*\)/i,Nb=/opacity\s*=\s*([^)]*)/,Ob=/^(none|table(?!-c[ea]).+)/,Pb=new RegExp("^("+S+")(.*)$","i"),Qb=new RegExp("^([+-])=("+S+")","i"),Rb={position:"absolute",visibility:"hidden",display:"block"},Sb={letterSpacing:"0",fontWeight:"400"},Tb=["Webkit","O","Moz","ms"];function Ub(a,b){if(b in a)return b;var c=b.charAt(0).toUpperCase()+b.slice(1),d=b,e=Tb.length;while(e--)if(b=Tb[e]+c,b in a)return b;return d}function Vb(a,b){for(var c,d,e,f=[],g=0,h=a.length;h>g;g++)d=a[g],d.style&&(f[g]=m._data(d,"olddisplay"),c=d.style.display,b?(f[g]||"none"!==c||(d.style.display=""),""===d.style.display&&U(d)&&(f[g]=m._data(d,"olddisplay",Fb(d.nodeName)))):(e=U(d),(c&&"none"!==c||!e)&&m._data(d,"olddisplay",e?c:m.css(d,"display"))));for(g=0;h>g;g++)d=a[g],d.style&&(b&&"none"!==d.style.display&&""!==d.style.display||(d.style.display=b?f[g]||"":"none"));return a}function Wb(a,b,c){var d=Pb.exec(b);return d?Math.max(0,d[1]-(c||0))+(d[2]||"px"):b}function Xb(a,b,c,d,e){for(var f=c===(d?"border":"content")?4:"width"===b?1:0,g=0;4>f;f+=2)"margin"===c&&(g+=m.css(a,c+T[f],!0,e)),d?("content"===c&&(g-=m.css(a,"padding"+T[f],!0,e)),"margin"!==c&&(g-=m.css(a,"border"+T[f]+"Width",!0,e))):(g+=m.css(a,"padding"+T[f],!0,e),"padding"!==c&&(g+=m.css(a,"border"+T[f]+"Width",!0,e)));return g}function Yb(a,b,c){var d=!0,e="width"===b?a.offsetWidth:a.offsetHeight,f=Ib(a),g=k.boxSizing&&"border-box"===m.css(a,"boxSizing",!1,f);if(0>=e||null==e){if(e=Jb(a,b,f),(0>e||null==e)&&(e=a.style[b]),Hb.test(e))return e;d=g&&(k.boxSizingReliable()||e===a.style[b]),e=parseFloat(e)||0}return e+Xb(a,b,c||(g?"border":"content"),d,f)+"px"}m.extend({cssHooks:{opacity:{get:function(a,b){if(b){var c=Jb(a,"opacity");return""===c?"1":c}}}},cssNumber:{columnCount:!0,fillOpacity:!0,flexGrow:!0,flexShrink:!0,fontWeight:!0,lineHeight:!0,opacity:!0,order:!0,orphans:!0,widows:!0,zIndex:!0,zoom:!0},cssProps:{"float":k.cssFloat?"cssFloat":"styleFloat"},style:function(a,b,c,d){if(a&&3!==a.nodeType&&8!==a.nodeType&&a.style){var e,f,g,h=m.camelCase(b),i=a.style;if(b=m.cssProps[h]||(m.cssProps[h]=Ub(i,h)),g=m.cssHooks[b]||m.cssHooks[h],void 0===c)return g&&"get"in g&&void 0!==(e=g.get(a,!1,d))?e:i[b];if(f=typeof c,"string"===f&&(e=Qb.exec(c))&&(c=(e[1]+1)*e[2]+parseFloat(m.css(a,b)),f="number"),null!=c&&c===c&&("number"!==f||m.cssNumber[h]||(c+="px"),k.clearCloneStyle||""!==c||0!==b.indexOf("background")||(i[b]="inherit"),!(g&&"set"in g&&void 0===(c=g.set(a,c,d)))))try{i[b]=c}catch(j){}}},css:function(a,b,c,d){var e,f,g,h=m.camelCase(b);return b=m.cssProps[h]||(m.cssProps[h]=Ub(a.style,h)),g=m.cssHooks[b]||m.cssHooks[h],g&&"get"in g&&(f=g.get(a,!0,c)),void 0===f&&(f=Jb(a,b,d)),"normal"===f&&b in Sb&&(f=Sb[b]),""===c||c?(e=parseFloat(f),c===!0||m.isNumeric(e)?e||0:f):f}}),m.each(["height","width"],function(a,b){m.cssHooks[b]={get:function(a,c,d){return c?Ob.test(m.css(a,"display"))&&0===a.offsetWidth?m.swap(a,Rb,function(){return Yb(a,b,d)}):Yb(a,b,d):void 0},set:function(a,c,d){var e=d&&Ib(a);return Wb(a,c,d?Xb(a,b,d,k.boxSizing&&"border-box"===m.css(a,"boxSizing",!1,e),e):0)}}}),k.opacity||(m.cssHooks.opacity={get:function(a,b){return Nb.test((b&&a.currentStyle?a.currentStyle.filter:a.style.filter)||"")?.01*parseFloat(RegExp.$1)+"":b?"1":""},set:function(a,b){var c=a.style,d=a.currentStyle,e=m.isNumeric(b)?"alpha(opacity="+100*b+")":"",f=d&&d.filter||c.filter||"";c.zoom=1,(b>=1||""===b)&&""===m.trim(f.replace(Mb,""))&&c.removeAttribute&&(c.removeAttribute("filter"),""===b||d&&!d.filter)||(c.filter=Mb.test(f)?f.replace(Mb,e):f+" "+e)}}),m.cssHooks.marginRight=Lb(k.reliableMarginRight,function(a,b){return b?m.swap(a,{display:"inline-block"},Jb,[a,"marginRight"]):void 0}),m.each({margin:"",padding:"",border:"Width"},function(a,b){m.cssHooks[a+b]={expand:function(c){for(var d=0,e={},f="string"==typeof c?c.split(" "):[c];4>d;d++)e[a+T[d]+b]=f[d]||f[d-2]||f[0];return e}},Gb.test(a)||(m.cssHooks[a+b].set=Wb)}),m.fn.extend({css:function(a,b){return V(this,function(a,b,c){var d,e,f={},g=0;if(m.isArray(b)){for(d=Ib(a),e=b.length;e>g;g++)f[b[g]]=m.css(a,b[g],!1,d);return f}return void 0!==c?m.style(a,b,c):m.css(a,b)},a,b,arguments.length>1)},show:function(){return Vb(this,!0)},hide:function(){return Vb(this)},toggle:function(a){return"boolean"==typeof a?a?this.show():this.hide():this.each(function(){U(this)?m(this).show():m(this).hide()})}});function Zb(a,b,c,d,e){return new Zb.prototype.init(a,b,c,d,e)}m.Tween=Zb,Zb.prototype={constructor:Zb,init:function(a,b,c,d,e,f){this.elem=a,this.prop=c,this.easing=e||"swing",this.options=b,this.start=this.now=this.cur(),this.end=d,this.unit=f||(m.cssNumber[c]?"":"px")
},cur:function(){var a=Zb.propHooks[this.prop];return a&&a.get?a.get(this):Zb.propHooks._default.get(this)},run:function(a){var b,c=Zb.propHooks[this.prop];return this.pos=b=this.options.duration?m.easing[this.easing](a,this.options.duration*a,0,1,this.options.duration):a,this.now=(this.end-this.start)*b+this.start,this.options.step&&this.options.step.call(this.elem,this.now,this),c&&c.set?c.set(this):Zb.propHooks._default.set(this),this}},Zb.prototype.init.prototype=Zb.prototype,Zb.propHooks={_default:{get:function(a){var b;return null==a.elem[a.prop]||a.elem.style&&null!=a.elem.style[a.prop]?(b=m.css(a.elem,a.prop,""),b&&"auto"!==b?b:0):a.elem[a.prop]},set:function(a){m.fx.step[a.prop]?m.fx.step[a.prop](a):a.elem.style&&(null!=a.elem.style[m.cssProps[a.prop]]||m.cssHooks[a.prop])?m.style(a.elem,a.prop,a.now+a.unit):a.elem[a.prop]=a.now}}},Zb.propHooks.scrollTop=Zb.propHooks.scrollLeft={set:function(a){a.elem.nodeType&&a.elem.parentNode&&(a.elem[a.prop]=a.now)}},m.easing={linear:function(a){return a},swing:function(a){return.5-Math.cos(a*Math.PI)/2}},m.fx=Zb.prototype.init,m.fx.step={};var $b,_b,ac=/^(?:toggle|show|hide)$/,bc=new RegExp("^(?:([+-])=|)("+S+")([a-z%]*)$","i"),cc=/queueHooks$/,dc=[ic],ec={"*":[function(a,b){var c=this.createTween(a,b),d=c.cur(),e=bc.exec(b),f=e&&e[3]||(m.cssNumber[a]?"":"px"),g=(m.cssNumber[a]||"px"!==f&&+d)&&bc.exec(m.css(c.elem,a)),h=1,i=20;if(g&&g[3]!==f){f=f||g[3],e=e||[],g=+d||1;do h=h||".5",g/=h,m.style(c.elem,a,g+f);while(h!==(h=c.cur()/d)&&1!==h&&--i)}return e&&(g=c.start=+g||+d||0,c.unit=f,c.end=e[1]?g+(e[1]+1)*e[2]:+e[2]),c}]};function fc(){return setTimeout(function(){$b=void 0}),$b=m.now()}function gc(a,b){var c,d={height:a},e=0;for(b=b?1:0;4>e;e+=2-b)c=T[e],d["margin"+c]=d["padding"+c]=a;return b&&(d.opacity=d.width=a),d}function hc(a,b,c){for(var d,e=(ec[b]||[]).concat(ec["*"]),f=0,g=e.length;g>f;f++)if(d=e[f].call(c,b,a))return d}function ic(a,b,c){var d,e,f,g,h,i,j,l,n=this,o={},p=a.style,q=a.nodeType&&U(a),r=m._data(a,"fxshow");c.queue||(h=m._queueHooks(a,"fx"),null==h.unqueued&&(h.unqueued=0,i=h.empty.fire,h.empty.fire=function(){h.unqueued||i()}),h.unqueued++,n.always(function(){n.always(function(){h.unqueued--,m.queue(a,"fx").length||h.empty.fire()})})),1===a.nodeType&&("height"in b||"width"in b)&&(c.overflow=[p.overflow,p.overflowX,p.overflowY],j=m.css(a,"display"),l="none"===j?m._data(a,"olddisplay")||Fb(a.nodeName):j,"inline"===l&&"none"===m.css(a,"float")&&(k.inlineBlockNeedsLayout&&"inline"!==Fb(a.nodeName)?p.zoom=1:p.display="inline-block")),c.overflow&&(p.overflow="hidden",k.shrinkWrapBlocks()||n.always(function(){p.overflow=c.overflow[0],p.overflowX=c.overflow[1],p.overflowY=c.overflow[2]}));for(d in b)if(e=b[d],ac.exec(e)){if(delete b[d],f=f||"toggle"===e,e===(q?"hide":"show")){if("show"!==e||!r||void 0===r[d])continue;q=!0}o[d]=r&&r[d]||m.style(a,d)}else j=void 0;if(m.isEmptyObject(o))"inline"===("none"===j?Fb(a.nodeName):j)&&(p.display=j);else{r?"hidden"in r&&(q=r.hidden):r=m._data(a,"fxshow",{}),f&&(r.hidden=!q),q?m(a).show():n.done(function(){m(a).hide()}),n.done(function(){var b;m._removeData(a,"fxshow");for(b in o)m.style(a,b,o[b])});for(d in o)g=hc(q?r[d]:0,d,n),d in r||(r[d]=g.start,q&&(g.end=g.start,g.start="width"===d||"height"===d?1:0))}}function jc(a,b){var c,d,e,f,g;for(c in a)if(d=m.camelCase(c),e=b[d],f=a[c],m.isArray(f)&&(e=f[1],f=a[c]=f[0]),c!==d&&(a[d]=f,delete a[c]),g=m.cssHooks[d],g&&"expand"in g){f=g.expand(f),delete a[d];for(c in f)c in a||(a[c]=f[c],b[c]=e)}else b[d]=e}function kc(a,b,c){var d,e,f=0,g=dc.length,h=m.Deferred().always(function(){delete i.elem}),i=function(){if(e)return!1;for(var b=$b||fc(),c=Math.max(0,j.startTime+j.duration-b),d=c/j.duration||0,f=1-d,g=0,i=j.tweens.length;i>g;g++)j.tweens[g].run(f);return h.notifyWith(a,[j,f,c]),1>f&&i?c:(h.resolveWith(a,[j]),!1)},j=h.promise({elem:a,props:m.extend({},b),opts:m.extend(!0,{specialEasing:{}},c),originalProperties:b,originalOptions:c,startTime:$b||fc(),duration:c.duration,tweens:[],createTween:function(b,c){var d=m.Tween(a,j.opts,b,c,j.opts.specialEasing[b]||j.opts.easing);return j.tweens.push(d),d},stop:function(b){var c=0,d=b?j.tweens.length:0;if(e)return this;for(e=!0;d>c;c++)j.tweens[c].run(1);return b?h.resolveWith(a,[j,b]):h.rejectWith(a,[j,b]),this}}),k=j.props;for(jc(k,j.opts.specialEasing);g>f;f++)if(d=dc[f].call(j,a,k,j.opts))return d;return m.map(k,hc,j),m.isFunction(j.opts.start)&&j.opts.start.call(a,j),m.fx.timer(m.extend(i,{elem:a,anim:j,queue:j.opts.queue})),j.progress(j.opts.progress).done(j.opts.done,j.opts.complete).fail(j.opts.fail).always(j.opts.always)}m.Animation=m.extend(kc,{tweener:function(a,b){m.isFunction(a)?(b=a,a=["*"]):a=a.split(" ");for(var c,d=0,e=a.length;e>d;d++)c=a[d],ec[c]=ec[c]||[],ec[c].unshift(b)},prefilter:function(a,b){b?dc.unshift(a):dc.push(a)}}),m.speed=function(a,b,c){var d=a&&"object"==typeof a?m.extend({},a):{complete:c||!c&&b||m.isFunction(a)&&a,duration:a,easing:c&&b||b&&!m.isFunction(b)&&b};return d.duration=m.fx.off?0:"number"==typeof d.duration?d.duration:d.duration in m.fx.speeds?m.fx.speeds[d.duration]:m.fx.speeds._default,(null==d.queue||d.queue===!0)&&(d.queue="fx"),d.old=d.complete,d.complete=function(){m.isFunction(d.old)&&d.old.call(this),d.queue&&m.dequeue(this,d.queue)},d},m.fn.extend({fadeTo:function(a,b,c,d){return this.filter(U).css("opacity",0).show().end().animate({opacity:b},a,c,d)},animate:function(a,b,c,d){var e=m.isEmptyObject(a),f=m.speed(b,c,d),g=function(){var b=kc(this,m.extend({},a),f);(e||m._data(this,"finish"))&&b.stop(!0)};return g.finish=g,e||f.queue===!1?this.each(g):this.queue(f.queue,g)},stop:function(a,b,c){var d=function(a){var b=a.stop;delete a.stop,b(c)};return"string"!=typeof a&&(c=b,b=a,a=void 0),b&&a!==!1&&this.queue(a||"fx",[]),this.each(function(){var b=!0,e=null!=a&&a+"queueHooks",f=m.timers,g=m._data(this);if(e)g[e]&&g[e].stop&&d(g[e]);else for(e in g)g[e]&&g[e].stop&&cc.test(e)&&d(g[e]);for(e=f.length;e--;)f[e].elem!==this||null!=a&&f[e].queue!==a||(f[e].anim.stop(c),b=!1,f.splice(e,1));(b||!c)&&m.dequeue(this,a)})},finish:function(a){return a!==!1&&(a=a||"fx"),this.each(function(){var b,c=m._data(this),d=c[a+"queue"],e=c[a+"queueHooks"],f=m.timers,g=d?d.length:0;for(c.finish=!0,m.queue(this,a,[]),e&&e.stop&&e.stop.call(this,!0),b=f.length;b--;)f[b].elem===this&&f[b].queue===a&&(f[b].anim.stop(!0),f.splice(b,1));for(b=0;g>b;b++)d[b]&&d[b].finish&&d[b].finish.call(this);delete c.finish})}}),m.each(["toggle","show","hide"],function(a,b){var c=m.fn[b];m.fn[b]=function(a,d,e){return null==a||"boolean"==typeof a?c.apply(this,arguments):this.animate(gc(b,!0),a,d,e)}}),m.each({slideDown:gc("show"),slideUp:gc("hide"),slideToggle:gc("toggle"),fadeIn:{opacity:"show"},fadeOut:{opacity:"hide"},fadeToggle:{opacity:"toggle"}},function(a,b){m.fn[a]=function(a,c,d){return this.animate(b,a,c,d)}}),m.timers=[],m.fx.tick=function(){var a,b=m.timers,c=0;for($b=m.now();c<b.length;c++)a=b[c],a()||b[c]!==a||b.splice(c--,1);b.length||m.fx.stop(),$b=void 0},m.fx.timer=function(a){m.timers.push(a),a()?m.fx.start():m.timers.pop()},m.fx.interval=13,m.fx.start=function(){_b||(_b=setInterval(m.fx.tick,m.fx.interval))},m.fx.stop=function(){clearInterval(_b),_b=null},m.fx.speeds={slow:600,fast:200,_default:400},m.fn.delay=function(a,b){return a=m.fx?m.fx.speeds[a]||a:a,b=b||"fx",this.queue(b,function(b,c){var d=setTimeout(b,a);c.stop=function(){clearTimeout(d)}})},function(){var a,b,c,d,e;b=y.createElement("div"),b.setAttribute("className","t"),b.innerHTML="  <link/><table></table><a href='/a'>a</a><input type='checkbox'/>",d=b.getElementsByTagName("a")[0],c=y.createElement("select"),e=c.appendChild(y.createElement("option")),a=b.getElementsByTagName("input")[0],d.style.cssText="top:1px",k.getSetAttribute="t"!==b.className,k.style=/top/.test(d.getAttribute("style")),k.hrefNormalized="/a"===d.getAttribute("href"),k.checkOn=!!a.value,k.optSelected=e.selected,k.enctype=!!y.createElement("form").enctype,c.disabled=!0,k.optDisabled=!e.disabled,a=y.createElement("input"),a.setAttribute("value",""),k.input=""===a.getAttribute("value"),a.value="t",a.setAttribute("type","radio"),k.radioValue="t"===a.value}();var lc=/\r/g;m.fn.extend({val:function(a){var b,c,d,e=this[0];{if(arguments.length)return d=m.isFunction(a),this.each(function(c){var e;1===this.nodeType&&(e=d?a.call(this,c,m(this).val()):a,null==e?e="":"number"==typeof e?e+="":m.isArray(e)&&(e=m.map(e,function(a){return null==a?"":a+""})),b=m.valHooks[this.type]||m.valHooks[this.nodeName.toLowerCase()],b&&"set"in b&&void 0!==b.set(this,e,"value")||(this.value=e))});if(e)return b=m.valHooks[e.type]||m.valHooks[e.nodeName.toLowerCase()],b&&"get"in b&&void 0!==(c=b.get(e,"value"))?c:(c=e.value,"string"==typeof c?c.replace(lc,""):null==c?"":c)}}}),m.extend({valHooks:{option:{get:function(a){var b=m.find.attr(a,"value");return null!=b?b:m.trim(m.text(a))}},select:{get:function(a){for(var b,c,d=a.options,e=a.selectedIndex,f="select-one"===a.type||0>e,g=f?null:[],h=f?e+1:d.length,i=0>e?h:f?e:0;h>i;i++)if(c=d[i],!(!c.selected&&i!==e||(k.optDisabled?c.disabled:null!==c.getAttribute("disabled"))||c.parentNode.disabled&&m.nodeName(c.parentNode,"optgroup"))){if(b=m(c).val(),f)return b;g.push(b)}return g},set:function(a,b){var c,d,e=a.options,f=m.makeArray(b),g=e.length;while(g--)if(d=e[g],m.inArray(m.valHooks.option.get(d),f)>=0)try{d.selected=c=!0}catch(h){d.scrollHeight}else d.selected=!1;return c||(a.selectedIndex=-1),e}}}}),m.each(["radio","checkbox"],function(){m.valHooks[this]={set:function(a,b){return m.isArray(b)?a.checked=m.inArray(m(a).val(),b)>=0:void 0}},k.checkOn||(m.valHooks[this].get=function(a){return null===a.getAttribute("value")?"on":a.value})});var mc,nc,oc=m.expr.attrHandle,pc=/^(?:checked|selected)$/i,qc=k.getSetAttribute,rc=k.input;m.fn.extend({attr:function(a,b){return V(this,m.attr,a,b,arguments.length>1)},removeAttr:function(a){return this.each(function(){m.removeAttr(this,a)})}}),m.extend({attr:function(a,b,c){var d,e,f=a.nodeType;if(a&&3!==f&&8!==f&&2!==f)return typeof a.getAttribute===K?m.prop(a,b,c):(1===f&&m.isXMLDoc(a)||(b=b.toLowerCase(),d=m.attrHooks[b]||(m.expr.match.bool.test(b)?nc:mc)),void 0===c?d&&"get"in d&&null!==(e=d.get(a,b))?e:(e=m.find.attr(a,b),null==e?void 0:e):null!==c?d&&"set"in d&&void 0!==(e=d.set(a,c,b))?e:(a.setAttribute(b,c+""),c):void m.removeAttr(a,b))},removeAttr:function(a,b){var c,d,e=0,f=b&&b.match(E);if(f&&1===a.nodeType)while(c=f[e++])d=m.propFix[c]||c,m.expr.match.bool.test(c)?rc&&qc||!pc.test(c)?a[d]=!1:a[m.camelCase("default-"+c)]=a[d]=!1:m.attr(a,c,""),a.removeAttribute(qc?c:d)},attrHooks:{type:{set:function(a,b){if(!k.radioValue&&"radio"===b&&m.nodeName(a,"input")){var c=a.value;return a.setAttribute("type",b),c&&(a.value=c),b}}}}}),nc={set:function(a,b,c){return b===!1?m.removeAttr(a,c):rc&&qc||!pc.test(c)?a.setAttribute(!qc&&m.propFix[c]||c,c):a[m.camelCase("default-"+c)]=a[c]=!0,c}},m.each(m.expr.match.bool.source.match(/\w+/g),function(a,b){var c=oc[b]||m.find.attr;oc[b]=rc&&qc||!pc.test(b)?function(a,b,d){var e,f;return d||(f=oc[b],oc[b]=e,e=null!=c(a,b,d)?b.toLowerCase():null,oc[b]=f),e}:function(a,b,c){return c?void 0:a[m.camelCase("default-"+b)]?b.toLowerCase():null}}),rc&&qc||(m.attrHooks.value={set:function(a,b,c){return m.nodeName(a,"input")?void(a.defaultValue=b):mc&&mc.set(a,b,c)}}),qc||(mc={set:function(a,b,c){var d=a.getAttributeNode(c);return d||a.setAttributeNode(d=a.ownerDocument.createAttribute(c)),d.value=b+="","value"===c||b===a.getAttribute(c)?b:void 0}},oc.id=oc.name=oc.coords=function(a,b,c){var d;return c?void 0:(d=a.getAttributeNode(b))&&""!==d.value?d.value:null},m.valHooks.button={get:function(a,b){var c=a.getAttributeNode(b);return c&&c.specified?c.value:void 0},set:mc.set},m.attrHooks.contenteditable={set:function(a,b,c){mc.set(a,""===b?!1:b,c)}},m.each(["width","height"],function(a,b){m.attrHooks[b]={set:function(a,c){return""===c?(a.setAttribute(b,"auto"),c):void 0}}})),k.style||(m.attrHooks.style={get:function(a){return a.style.cssText||void 0},set:function(a,b){return a.style.cssText=b+""}});var sc=/^(?:input|select|textarea|button|object)$/i,tc=/^(?:a|area)$/i;m.fn.extend({prop:function(a,b){return V(this,m.prop,a,b,arguments.length>1)},removeProp:function(a){return a=m.propFix[a]||a,this.each(function(){try{this[a]=void 0,delete this[a]}catch(b){}})}}),m.extend({propFix:{"for":"htmlFor","class":"className"},prop:function(a,b,c){var d,e,f,g=a.nodeType;if(a&&3!==g&&8!==g&&2!==g)return f=1!==g||!m.isXMLDoc(a),f&&(b=m.propFix[b]||b,e=m.propHooks[b]),void 0!==c?e&&"set"in e&&void 0!==(d=e.set(a,c,b))?d:a[b]=c:e&&"get"in e&&null!==(d=e.get(a,b))?d:a[b]},propHooks:{tabIndex:{get:function(a){var b=m.find.attr(a,"tabindex");return b?parseInt(b,10):sc.test(a.nodeName)||tc.test(a.nodeName)&&a.href?0:-1}}}}),k.hrefNormalized||m.each(["href","src"],function(a,b){m.propHooks[b]={get:function(a){return a.getAttribute(b,4)}}}),k.optSelected||(m.propHooks.selected={get:function(a){var b=a.parentNode;return b&&(b.selectedIndex,b.parentNode&&b.parentNode.selectedIndex),null}}),m.each(["tabIndex","readOnly","maxLength","cellSpacing","cellPadding","rowSpan","colSpan","useMap","frameBorder","contentEditable"],function(){m.propFix[this.toLowerCase()]=this}),k.enctype||(m.propFix.enctype="encoding");var uc=/[\t\r\n\f]/g;m.fn.extend({addClass:function(a){var b,c,d,e,f,g,h=0,i=this.length,j="string"==typeof a&&a;if(m.isFunction(a))return this.each(function(b){m(this).addClass(a.call(this,b,this.className))});if(j)for(b=(a||"").match(E)||[];i>h;h++)if(c=this[h],d=1===c.nodeType&&(c.className?(" "+c.className+" ").replace(uc," "):" ")){f=0;while(e=b[f++])d.indexOf(" "+e+" ")<0&&(d+=e+" ");g=m.trim(d),c.className!==g&&(c.className=g)}return this},removeClass:function(a){var b,c,d,e,f,g,h=0,i=this.length,j=0===arguments.length||"string"==typeof a&&a;if(m.isFunction(a))return this.each(function(b){m(this).removeClass(a.call(this,b,this.className))});if(j)for(b=(a||"").match(E)||[];i>h;h++)if(c=this[h],d=1===c.nodeType&&(c.className?(" "+c.className+" ").replace(uc," "):"")){f=0;while(e=b[f++])while(d.indexOf(" "+e+" ")>=0)d=d.replace(" "+e+" "," ");g=a?m.trim(d):"",c.className!==g&&(c.className=g)}return this},toggleClass:function(a,b){var c=typeof a;return"boolean"==typeof b&&"string"===c?b?this.addClass(a):this.removeClass(a):this.each(m.isFunction(a)?function(c){m(this).toggleClass(a.call(this,c,this.className,b),b)}:function(){if("string"===c){var b,d=0,e=m(this),f=a.match(E)||[];while(b=f[d++])e.hasClass(b)?e.removeClass(b):e.addClass(b)}else(c===K||"boolean"===c)&&(this.className&&m._data(this,"__className__",this.className),this.className=this.className||a===!1?"":m._data(this,"__className__")||"")})},hasClass:function(a){for(var b=" "+a+" ",c=0,d=this.length;d>c;c++)if(1===this[c].nodeType&&(" "+this[c].className+" ").replace(uc," ").indexOf(b)>=0)return!0;return!1}}),m.each("blur focus focusin focusout load resize scroll unload click dblclick mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave change select submit keydown keypress keyup error contextmenu".split(" "),function(a,b){m.fn[b]=function(a,c){return arguments.length>0?this.on(b,null,a,c):this.trigger(b)}}),m.fn.extend({hover:function(a,b){return this.mouseenter(a).mouseleave(b||a)},bind:function(a,b,c){return this.on(a,null,b,c)},unbind:function(a,b){return this.off(a,null,b)},delegate:function(a,b,c,d){return this.on(b,a,c,d)},undelegate:function(a,b,c){return 1===arguments.length?this.off(a,"**"):this.off(b,a||"**",c)}});var vc=m.now(),wc=/\?/,xc=/(,)|(\[|{)|(}|])|"(?:[^"\\\r\n]|\\["\\\/bfnrt]|\\u[\da-fA-F]{4})*"\s*:?|true|false|null|-?(?!0\d)\d+(?:\.\d+|)(?:[eE][+-]?\d+|)/g;m.parseJSON=function(b){if(a.JSON&&a.JSON.parse)return a.JSON.parse(b+"");var c,d=null,e=m.trim(b+"");return e&&!m.trim(e.replace(xc,function(a,b,e,f){return c&&b&&(d=0),0===d?a:(c=e||b,d+=!f-!e,"")}))?Function("return "+e)():m.error("Invalid JSON: "+b)},m.parseXML=function(b){var c,d;if(!b||"string"!=typeof b)return null;try{a.DOMParser?(d=new DOMParser,c=d.parseFromString(b,"text/xml")):(c=new ActiveXObject("Microsoft.XMLDOM"),c.async="false",c.loadXML(b))}catch(e){c=void 0}return c&&c.documentElement&&!c.getElementsByTagName("parsererror").length||m.error("Invalid XML: "+b),c};var yc,zc,Ac=/#.*$/,Bc=/([?&])_=[^&]*/,Cc=/^(.*?):[ \t]*([^\r\n]*)\r?$/gm,Dc=/^(?:about|app|app-storage|.+-extension|file|res|widget):$/,Ec=/^(?:GET|HEAD)$/,Fc=/^\/\//,Gc=/^([\w.+-]+:)(?:\/\/(?:[^\/?#]*@|)([^\/?#:]*)(?::(\d+)|)|)/,Hc={},Ic={},Jc="*/".concat("*");try{zc=location.href}catch(Kc){zc=y.createElement("a"),zc.href="",zc=zc.href}yc=Gc.exec(zc.toLowerCase())||[];function Lc(a){return function(b,c){"string"!=typeof b&&(c=b,b="*");var d,e=0,f=b.toLowerCase().match(E)||[];if(m.isFunction(c))while(d=f[e++])"+"===d.charAt(0)?(d=d.slice(1)||"*",(a[d]=a[d]||[]).unshift(c)):(a[d]=a[d]||[]).push(c)}}function Mc(a,b,c,d){var e={},f=a===Ic;function g(h){var i;return e[h]=!0,m.each(a[h]||[],function(a,h){var j=h(b,c,d);return"string"!=typeof j||f||e[j]?f?!(i=j):void 0:(b.dataTypes.unshift(j),g(j),!1)}),i}return g(b.dataTypes[0])||!e["*"]&&g("*")}function Nc(a,b){var c,d,e=m.ajaxSettings.flatOptions||{};for(d in b)void 0!==b[d]&&((e[d]?a:c||(c={}))[d]=b[d]);return c&&m.extend(!0,a,c),a}function Oc(a,b,c){var d,e,f,g,h=a.contents,i=a.dataTypes;while("*"===i[0])i.shift(),void 0===e&&(e=a.mimeType||b.getResponseHeader("Content-Type"));if(e)for(g in h)if(h[g]&&h[g].test(e)){i.unshift(g);break}if(i[0]in c)f=i[0];else{for(g in c){if(!i[0]||a.converters[g+" "+i[0]]){f=g;break}d||(d=g)}f=f||d}return f?(f!==i[0]&&i.unshift(f),c[f]):void 0}function Pc(a,b,c,d){var e,f,g,h,i,j={},k=a.dataTypes.slice();if(k[1])for(g in a.converters)j[g.toLowerCase()]=a.converters[g];f=k.shift();while(f)if(a.responseFields[f]&&(c[a.responseFields[f]]=b),!i&&d&&a.dataFilter&&(b=a.dataFilter(b,a.dataType)),i=f,f=k.shift())if("*"===f)f=i;else if("*"!==i&&i!==f){if(g=j[i+" "+f]||j["* "+f],!g)for(e in j)if(h=e.split(" "),h[1]===f&&(g=j[i+" "+h[0]]||j["* "+h[0]])){g===!0?g=j[e]:j[e]!==!0&&(f=h[0],k.unshift(h[1]));break}if(g!==!0)if(g&&a["throws"])b=g(b);else try{b=g(b)}catch(l){return{state:"parsererror",error:g?l:"No conversion from "+i+" to "+f}}}return{state:"success",data:b}}m.extend({active:0,lastModified:{},etag:{},ajaxSettings:{url:zc,type:"GET",isLocal:Dc.test(yc[1]),global:!0,processData:!0,async:!0,contentType:"application/x-www-form-urlencoded; charset=UTF-8",accepts:{"*":Jc,text:"text/plain",html:"text/html",xml:"application/xml, text/xml",json:"application/json, text/javascript"},contents:{xml:/xml/,html:/html/,json:/json/},responseFields:{xml:"responseXML",text:"responseText",json:"responseJSON"},converters:{"* text":String,"text html":!0,"text json":m.parseJSON,"text xml":m.parseXML},flatOptions:{url:!0,context:!0}},ajaxSetup:function(a,b){return b?Nc(Nc(a,m.ajaxSettings),b):Nc(m.ajaxSettings,a)},ajaxPrefilter:Lc(Hc),ajaxTransport:Lc(Ic),ajax:function(a,b){"object"==typeof a&&(b=a,a=void 0),b=b||{};var c,d,e,f,g,h,i,j,k=m.ajaxSetup({},b),l=k.context||k,n=k.context&&(l.nodeType||l.jquery)?m(l):m.event,o=m.Deferred(),p=m.Callbacks("once memory"),q=k.statusCode||{},r={},s={},t=0,u="canceled",v={readyState:0,getResponseHeader:function(a){var b;if(2===t){if(!j){j={};while(b=Cc.exec(f))j[b[1].toLowerCase()]=b[2]}b=j[a.toLowerCase()]}return null==b?null:b},getAllResponseHeaders:function(){return 2===t?f:null},setRequestHeader:function(a,b){var c=a.toLowerCase();return t||(a=s[c]=s[c]||a,r[a]=b),this},overrideMimeType:function(a){return t||(k.mimeType=a),this},statusCode:function(a){var b;if(a)if(2>t)for(b in a)q[b]=[q[b],a[b]];else v.always(a[v.status]);return this},abort:function(a){var b=a||u;return i&&i.abort(b),x(0,b),this}};if(o.promise(v).complete=p.add,v.success=v.done,v.error=v.fail,k.url=((a||k.url||zc)+"").replace(Ac,"").replace(Fc,yc[1]+"//"),k.type=b.method||b.type||k.method||k.type,k.dataTypes=m.trim(k.dataType||"*").toLowerCase().match(E)||[""],null==k.crossDomain&&(c=Gc.exec(k.url.toLowerCase()),k.crossDomain=!(!c||c[1]===yc[1]&&c[2]===yc[2]&&(c[3]||("http:"===c[1]?"80":"443"))===(yc[3]||("http:"===yc[1]?"80":"443")))),k.data&&k.processData&&"string"!=typeof k.data&&(k.data=m.param(k.data,k.traditional)),Mc(Hc,k,b,v),2===t)return v;h=k.global,h&&0===m.active++&&m.event.trigger("ajaxStart"),k.type=k.type.toUpperCase(),k.hasContent=!Ec.test(k.type),e=k.url,k.hasContent||(k.data&&(e=k.url+=(wc.test(e)?"&":"?")+k.data,delete k.data),k.cache===!1&&(k.url=Bc.test(e)?e.replace(Bc,"$1_="+vc++):e+(wc.test(e)?"&":"?")+"_="+vc++)),k.ifModified&&(m.lastModified[e]&&v.setRequestHeader("If-Modified-Since",m.lastModified[e]),m.etag[e]&&v.setRequestHeader("If-None-Match",m.etag[e])),(k.data&&k.hasContent&&k.contentType!==!1||b.contentType)&&v.setRequestHeader("Content-Type",k.contentType),v.setRequestHeader("Accept",k.dataTypes[0]&&k.accepts[k.dataTypes[0]]?k.accepts[k.dataTypes[0]]+("*"!==k.dataTypes[0]?", "+Jc+"; q=0.01":""):k.accepts["*"]);for(d in k.headers)v.setRequestHeader(d,k.headers[d]);if(k.beforeSend&&(k.beforeSend.call(l,v,k)===!1||2===t))return v.abort();u="abort";for(d in{success:1,error:1,complete:1})v[d](k[d]);if(i=Mc(Ic,k,b,v)){v.readyState=1,h&&n.trigger("ajaxSend",[v,k]),k.async&&k.timeout>0&&(g=setTimeout(function(){v.abort("timeout")},k.timeout));try{t=1,i.send(r,x)}catch(w){if(!(2>t))throw w;x(-1,w)}}else x(-1,"No Transport");function x(a,b,c,d){var j,r,s,u,w,x=b;2!==t&&(t=2,g&&clearTimeout(g),i=void 0,f=d||"",v.readyState=a>0?4:0,j=a>=200&&300>a||304===a,c&&(u=Oc(k,v,c)),u=Pc(k,u,v,j),j?(k.ifModified&&(w=v.getResponseHeader("Last-Modified"),w&&(m.lastModified[e]=w),w=v.getResponseHeader("etag"),w&&(m.etag[e]=w)),204===a||"HEAD"===k.type?x="nocontent":304===a?x="notmodified":(x=u.state,r=u.data,s=u.error,j=!s)):(s=x,(a||!x)&&(x="error",0>a&&(a=0))),v.status=a,v.statusText=(b||x)+"",j?o.resolveWith(l,[r,x,v]):o.rejectWith(l,[v,x,s]),v.statusCode(q),q=void 0,h&&n.trigger(j?"ajaxSuccess":"ajaxError",[v,k,j?r:s]),p.fireWith(l,[v,x]),h&&(n.trigger("ajaxComplete",[v,k]),--m.active||m.event.trigger("ajaxStop")))}return v},getJSON:function(a,b,c){return m.get(a,b,c,"json")},getScript:function(a,b){return m.get(a,void 0,b,"script")}}),m.each(["get","post"],function(a,b){m[b]=function(a,c,d,e){return m.isFunction(c)&&(e=e||d,d=c,c=void 0),m.ajax({url:a,type:b,dataType:e,data:c,success:d})}}),m.each(["ajaxStart","ajaxStop","ajaxComplete","ajaxError","ajaxSuccess","ajaxSend"],function(a,b){m.fn[b]=function(a){return this.on(b,a)}}),m._evalUrl=function(a){return m.ajax({url:a,type:"GET",dataType:"script",async:!1,global:!1,"throws":!0})},m.fn.extend({wrapAll:function(a){if(m.isFunction(a))return this.each(function(b){m(this).wrapAll(a.call(this,b))});if(this[0]){var b=m(a,this[0].ownerDocument).eq(0).clone(!0);this[0].parentNode&&b.insertBefore(this[0]),b.map(function(){var a=this;while(a.firstChild&&1===a.firstChild.nodeType)a=a.firstChild;return a}).append(this)}return this},wrapInner:function(a){return this.each(m.isFunction(a)?function(b){m(this).wrapInner(a.call(this,b))}:function(){var b=m(this),c=b.contents();c.length?c.wrapAll(a):b.append(a)})},wrap:function(a){var b=m.isFunction(a);return this.each(function(c){m(this).wrapAll(b?a.call(this,c):a)})},unwrap:function(){return this.parent().each(function(){m.nodeName(this,"body")||m(this).replaceWith(this.childNodes)}).end()}}),m.expr.filters.hidden=function(a){return a.offsetWidth<=0&&a.offsetHeight<=0||!k.reliableHiddenOffsets()&&"none"===(a.style&&a.style.display||m.css(a,"display"))},m.expr.filters.visible=function(a){return!m.expr.filters.hidden(a)};var Qc=/%20/g,Rc=/\[\]$/,Sc=/\r?\n/g,Tc=/^(?:submit|button|image|reset|file)$/i,Uc=/^(?:input|select|textarea|keygen)/i;function Vc(a,b,c,d){var e;if(m.isArray(b))m.each(b,function(b,e){c||Rc.test(a)?d(a,e):Vc(a+"["+("object"==typeof e?b:"")+"]",e,c,d)});else if(c||"object"!==m.type(b))d(a,b);else for(e in b)Vc(a+"["+e+"]",b[e],c,d)}m.param=function(a,b){var c,d=[],e=function(a,b){b=m.isFunction(b)?b():null==b?"":b,d[d.length]=encodeURIComponent(a)+"="+encodeURIComponent(b)};if(void 0===b&&(b=m.ajaxSettings&&m.ajaxSettings.traditional),m.isArray(a)||a.jquery&&!m.isPlainObject(a))m.each(a,function(){e(this.name,this.value)});else for(c in a)Vc(c,a[c],b,e);return d.join("&").replace(Qc,"+")},m.fn.extend({serialize:function(){return m.param(this.serializeArray())},serializeArray:function(){return this.map(function(){var a=m.prop(this,"elements");return a?m.makeArray(a):this}).filter(function(){var a=this.type;return this.name&&!m(this).is(":disabled")&&Uc.test(this.nodeName)&&!Tc.test(a)&&(this.checked||!W.test(a))}).map(function(a,b){var c=m(this).val();return null==c?null:m.isArray(c)?m.map(c,function(a){return{name:b.name,value:a.replace(Sc,"\r\n")}}):{name:b.name,value:c.replace(Sc,"\r\n")}}).get()}}),m.ajaxSettings.xhr=void 0!==a.ActiveXObject?function(){return!this.isLocal&&/^(get|post|head|put|delete|options)$/i.test(this.type)&&Zc()||$c()}:Zc;var Wc=0,Xc={},Yc=m.ajaxSettings.xhr();a.ActiveXObject&&m(a).on("unload",function(){for(var a in Xc)Xc[a](void 0,!0)}),k.cors=!!Yc&&"withCredentials"in Yc,Yc=k.ajax=!!Yc,Yc&&m.ajaxTransport(function(a){if(!a.crossDomain||k.cors){var b;return{send:function(c,d){var e,f=a.xhr(),g=++Wc;if(f.open(a.type,a.url,a.async,a.username,a.password),a.xhrFields)for(e in a.xhrFields)f[e]=a.xhrFields[e];a.mimeType&&f.overrideMimeType&&f.overrideMimeType(a.mimeType),a.crossDomain||c["X-Requested-With"]||(c["X-Requested-With"]="XMLHttpRequest");for(e in c)void 0!==c[e]&&f.setRequestHeader(e,c[e]+"");f.send(a.hasContent&&a.data||null),b=function(c,e){var h,i,j;if(b&&(e||4===f.readyState))if(delete Xc[g],b=void 0,f.onreadystatechange=m.noop,e)4!==f.readyState&&f.abort();else{j={},h=f.status,"string"==typeof f.responseText&&(j.text=f.responseText);try{i=f.statusText}catch(k){i=""}h||!a.isLocal||a.crossDomain?1223===h&&(h=204):h=j.text?200:404}j&&d(h,i,j,f.getAllResponseHeaders())},a.async?4===f.readyState?setTimeout(b):f.onreadystatechange=Xc[g]=b:b()},abort:function(){b&&b(void 0,!0)}}}});function Zc(){try{return new a.XMLHttpRequest}catch(b){}}function $c(){try{return new a.ActiveXObject("Microsoft.XMLHTTP")}catch(b){}}m.ajaxSetup({accepts:{script:"text/javascript, application/javascript, application/ecmascript, application/x-ecmascript"},contents:{script:/(?:java|ecma)script/},converters:{"text script":function(a){return m.globalEval(a),a}}}),m.ajaxPrefilter("script",function(a){void 0===a.cache&&(a.cache=!1),a.crossDomain&&(a.type="GET",a.global=!1)}),m.ajaxTransport("script",function(a){if(a.crossDomain){var b,c=y.head||m("head")[0]||y.documentElement;return{send:function(d,e){b=y.createElement("script"),b.async=!0,a.scriptCharset&&(b.charset=a.scriptCharset),b.src=a.url,b.onload=b.onreadystatechange=function(a,c){(c||!b.readyState||/loaded|complete/.test(b.readyState))&&(b.onload=b.onreadystatechange=null,b.parentNode&&b.parentNode.removeChild(b),b=null,c||e(200,"success"))},c.insertBefore(b,c.firstChild)},abort:function(){b&&b.onload(void 0,!0)}}}});var _c=[],ad=/(=)\?(?=&|$)|\?\?/;m.ajaxSetup({jsonp:"callback",jsonpCallback:function(){var a=_c.pop()||m.expando+"_"+vc++;return this[a]=!0,a}}),m.ajaxPrefilter("json jsonp",function(b,c,d){var e,f,g,h=b.jsonp!==!1&&(ad.test(b.url)?"url":"string"==typeof b.data&&!(b.contentType||"").indexOf("application/x-www-form-urlencoded")&&ad.test(b.data)&&"data");return h||"jsonp"===b.dataTypes[0]?(e=b.jsonpCallback=m.isFunction(b.jsonpCallback)?b.jsonpCallback():b.jsonpCallback,h?b[h]=b[h].replace(ad,"$1"+e):b.jsonp!==!1&&(b.url+=(wc.test(b.url)?"&":"?")+b.jsonp+"="+e),b.converters["script json"]=function(){return g||m.error(e+" was not called"),g[0]},b.dataTypes[0]="json",f=a[e],a[e]=function(){g=arguments},d.always(function(){a[e]=f,b[e]&&(b.jsonpCallback=c.jsonpCallback,_c.push(e)),g&&m.isFunction(f)&&f(g[0]),g=f=void 0}),"script"):void 0}),m.parseHTML=function(a,b,c){if(!a||"string"!=typeof a)return null;"boolean"==typeof b&&(c=b,b=!1),b=b||y;var d=u.exec(a),e=!c&&[];return d?[b.createElement(d[1])]:(d=m.buildFragment([a],b,e),e&&e.length&&m(e).remove(),m.merge([],d.childNodes))};var bd=m.fn.load;m.fn.load=function(a,b,c){if("string"!=typeof a&&bd)return bd.apply(this,arguments);var d,e,f,g=this,h=a.indexOf(" ");return h>=0&&(d=m.trim(a.slice(h,a.length)),a=a.slice(0,h)),m.isFunction(b)?(c=b,b=void 0):b&&"object"==typeof b&&(f="POST"),g.length>0&&m.ajax({url:a,type:f,dataType:"html",data:b}).done(function(a){e=arguments,g.html(d?m("<div>").append(m.parseHTML(a)).find(d):a)}).complete(c&&function(a,b){g.each(c,e||[a.responseText,b,a])}),this},m.expr.filters.animated=function(a){return m.grep(m.timers,function(b){return a===b.elem}).length};var cd=a.document.documentElement;function dd(a){return m.isWindow(a)?a:9===a.nodeType?a.defaultView||a.parentWindow:!1}m.offset={setOffset:function(a,b,c){var d,e,f,g,h,i,j,k=m.css(a,"position"),l=m(a),n={};"static"===k&&(a.style.position="relative"),h=l.offset(),f=m.css(a,"top"),i=m.css(a,"left"),j=("absolute"===k||"fixed"===k)&&m.inArray("auto",[f,i])>-1,j?(d=l.position(),g=d.top,e=d.left):(g=parseFloat(f)||0,e=parseFloat(i)||0),m.isFunction(b)&&(b=b.call(a,c,h)),null!=b.top&&(n.top=b.top-h.top+g),null!=b.left&&(n.left=b.left-h.left+e),"using"in b?b.using.call(a,n):l.css(n)}},m.fn.extend({offset:function(a){if(arguments.length)return void 0===a?this:this.each(function(b){m.offset.setOffset(this,a,b)});var b,c,d={top:0,left:0},e=this[0],f=e&&e.ownerDocument;if(f)return b=f.documentElement,m.contains(b,e)?(typeof e.getBoundingClientRect!==K&&(d=e.getBoundingClientRect()),c=dd(f),{top:d.top+(c.pageYOffset||b.scrollTop)-(b.clientTop||0),left:d.left+(c.pageXOffset||b.scrollLeft)-(b.clientLeft||0)}):d},position:function(){if(this[0]){var a,b,c={top:0,left:0},d=this[0];return"fixed"===m.css(d,"position")?b=d.getBoundingClientRect():(a=this.offsetParent(),b=this.offset(),m.nodeName(a[0],"html")||(c=a.offset()),c.top+=m.css(a[0],"borderTopWidth",!0),c.left+=m.css(a[0],"borderLeftWidth",!0)),{top:b.top-c.top-m.css(d,"marginTop",!0),left:b.left-c.left-m.css(d,"marginLeft",!0)}}},offsetParent:function(){return this.map(function(){var a=this.offsetParent||cd;while(a&&!m.nodeName(a,"html")&&"static"===m.css(a,"position"))a=a.offsetParent;return a||cd})}}),m.each({scrollLeft:"pageXOffset",scrollTop:"pageYOffset"},function(a,b){var c=/Y/.test(b);m.fn[a]=function(d){return V(this,function(a,d,e){var f=dd(a);return void 0===e?f?b in f?f[b]:f.document.documentElement[d]:a[d]:void(f?f.scrollTo(c?m(f).scrollLeft():e,c?e:m(f).scrollTop()):a[d]=e)},a,d,arguments.length,null)}}),m.each(["top","left"],function(a,b){m.cssHooks[b]=Lb(k.pixelPosition,function(a,c){return c?(c=Jb(a,b),Hb.test(c)?m(a).position()[b]+"px":c):void 0})}),m.each({Height:"height",Width:"width"},function(a,b){m.each({padding:"inner"+a,content:b,"":"outer"+a},function(c,d){m.fn[d]=function(d,e){var f=arguments.length&&(c||"boolean"!=typeof d),g=c||(d===!0||e===!0?"margin":"border");return V(this,function(b,c,d){var e;return m.isWindow(b)?b.document.documentElement["client"+a]:9===b.nodeType?(e=b.documentElement,Math.max(b.body["scroll"+a],e["scroll"+a],b.body["offset"+a],e["offset"+a],e["client"+a])):void 0===d?m.css(b,c,g):m.style(b,c,d,g)},b,f?d:void 0,f,null)}})}),m.fn.size=function(){return this.length},m.fn.andSelf=m.fn.addBack,"function"==typeof define&&define.amd&&define("jquery",[],function(){return m});var ed=a.jQuery,fd=a.$;return m.noConflict=function(b){return a.$===m&&(a.$=fd),b&&a.jQuery===m&&(a.jQuery=ed),m},typeof b===K&&(a.jQuery=a.$=m),m});

/* Requires jQuery
 *
 * This plugin will create div.jsTooltip elements (or configure your own!) in body for every tooltip on the page. Some
 * basic CSS is applied automagically, but you'll want to style it on your own from there. This code will be applied to
 * every element in your .v_tooltip() selector, so giving it a common selector like '.tooltip' is ideal.
 *
 * Options:
 * - location: Where the tooltip should spawn in relation to it's parent
 * - offsetN: How many pixels to add
 * - trackMouse: Should we track the mouse cursor instead of the parent?
 * - suppressOnClick: Should we hide if a user clicks the target?
 * - suppressWhileToggled: Should we ignore events if the target has the 'toggled' class?
 * - tooltipClass: css class to apply to tooltip elements
 * - fadeSpeed:	Time (in milliseconds) to spend fading in/out. Set to 0 to disable.
 * - allowHover: Should we keep the tooltip open if we mouse directly on to the tooltip? (Your tooltip will need to spawn inside it's owner's box for this to work)
 * - tooltipParent: More generally useless properties for supernav: Lets us specify which element to parent the tooltips to. YOU PROBABLY DON'T NEED THIS.
 * - correctForScreenSize: Adjust tooltip position to ensure it doesn't render outside of the viewport
 * - sizeCorrectionXPadding: How far we should keep the tooltip from the window edge
 * - useClickEvent: Should we use the mouse click event instead of hover?
 * - inheritParentMinWidth: Should we set min-width based on our parent's width?
 * - parentActiveCSSClass: What CSS class should we add to our parent while we're visible?
 * - childActiveCSSClass: What CSS class should we add to the tooltip when active (Mostly useful for triggering CSS transitions
 * - funcName: Global name of a function to call on hover (It searches the global window object; not safe inside "use strict"
 * - func: Actual JS code to run.
 */
/* <script> */
(function( $ ){
	var methods = {

		init : function( options ) {

			var settings = $.extend( {
				'location'			: 'top',
				'offsetX'			: 0,
				'offsetY'			: -10,
				'trackMouse'		: false,
				'trackMouseCentered': true,
				'suppressOnClick'	: true,
				'suppressWhileToggled': true,
				'tooltipClass'		: 'jsTooltip',
				'fadeSpeed'			: 150,
				'allowHover'		: true,
				'tooltipParent'		: 'body',
				'correctForScreenSize': true,
				'sizeCorrectionXPadding': 15,
				'sizeCorrectionYPadding': 10,
				'useClickEvent'		: false,
				'useContextMenuEvent'	: false,
				'preventDefault'	: true,
				'inheritParentMinWidth'	: false,
				'parentActiveCSSClass'	: false,
				'dataName'			: 'tooltipContent',
				'funcName'			: 'tooltipFunc',
				'func'				: false,
				'disableOnTouchDevice'	: false,
				'childActiveCSSClass' : false,
				'destroyWhenDone': true
			}, options);




			return this.each(function(){

				var $target = $(this);
				if( settings.useClickEvent )
				{
					$target.bind('click.tooltip', methods.show);
				}
				else if( settings.useContextMenuEvent )
				{
					$target.bind('contextmenu.tooltip', methods.show);
				}
				else
				{
					$target.bind('mouseenter.tooltip', methods.show);
				}
				$target.bind('mouseleave.tooltip', methods.hide);

				if ( settings.disableOnTouchDevice )
				{
					// if we get a touch event, disable tooltip events on this object.  This fires before mouse events, so we
					//	can prevent the hover from showing.
					//	(we could preventDefault(), but that will prevent the actual click event that's coming too)
					$target.bind('touchstart.tooltip', function(e) { $target.data('inTouchEvent', true); });
					$target.bind('mouseup.tooltip', function(e) { $target.data('inTouchEvent', false); });
				}

				$target.data('tooltip.settings', settings);
			});

		},
		destroy : function() {

			return this.each(function(){
				$(window).unbind('.tooltip');
			})

		},
		gettooltip : function( element, settings ) {
			var $element= $(element);
			var toolDiv = $element.data("tooltip.element");
			if ( !toolDiv )
			{
				toolDiv = $('<div />');

				if( settings.suppressOnClick )
				{
					toolDiv.bind('click.tooltip', jQuery.proxy(methods.hide, element));
				}
				toolDiv.hide();
				toolDiv.addClass(settings.tooltipClass)
				toolDiv.css({
					position: 'absolute',
					'z-index': 1500
				});
				var type = $element.data('tooltip-type');

				var content = '';
				if ( settings.dataAttr )
					content = $element.attr( settings.dataAttr );
				else if ( settings.dataName )
					content = $element.data(settings.dataName);

				if( type == 'text')
				{
					toolDiv.text( content );
				}
				else if ( type == 'selector' )
				{
					var toolElement = $( content, $element.parent() );
					toolDiv.data( 'originalParent', toolElement.parent() );
					toolDiv.append( toolElement.show() );
					toolDiv.data( 'preserveContent', true );
				}
				else
				{
					toolDiv.html( content );
				}

				$( settings.tooltipParent || $element.parent() ).append(toolDiv);
				$element.data("tooltip.element", toolDiv);

			}

			var funcName = settings.funcName && $(element).data( settings.funcName );
			if( funcName )
			{
				if( type == 'text')
					toolDiv.text( window[funcName](element) );
				else
					toolDiv.html( window[funcName](element) );
			}

			if( settings.func )
				settings.func.bind(toolDiv)(element);

			return toolDiv;
		},
		updateposition : function() {
		    var newPosition = {};
		    var settings = $(this).data('tooltip.settings');
		    var toolDiv = methods.gettooltip( this, settings );

		    var parentPosition = $(this).offset();
		    if( settings.tooltipParent != 'body' )
		        parentPosition = $(this).position();

		    switch( settings.location )
		    {
		        case 'top':
		            newPosition = {
		                left: parentPosition.left + settings.offsetX,
		                top: parentPosition.top - toolDiv.outerHeight() + settings.offsetY
		            };
		            break;

		        case 'bottom':
		            newPosition = {
		                left: parentPosition.left + settings.offsetX,
		                top: parentPosition.top + $(this).outerHeight() + settings.offsetY
		            };
		            break;

				case 'bottom left':

					newPosition = {
						left: parentPosition.left + settings.offsetX - toolDiv.outerWidth(),
						top: parentPosition.top + $(this).outerHeight() + settings.offsetY
					};
					break;

				default:
					console.log("Invalid location passed to v_tooltip: %s", settings.location);
		    }
		    // Correct for window size
		    if( settings.correctForScreenSize )
		    {
		        var rightEdge = newPosition.left + toolDiv.width();
		        var windowRightEdge = $(window).width() - settings.sizeCorrectionXPadding + $(window).scrollLeft();
		        var windowLeftEdge =  $(window).scrollLeft() + settings.sizeCorrectionXPadding;

		        if( rightEdge > windowRightEdge )
		            newPosition.left = windowRightEdge - toolDiv.width() - settings.sizeCorrectionXPadding;

		        if( newPosition.left < windowLeftEdge )
		            newPosition.left = windowLeftEdge;

				if ( newPosition.top < 0 )
					newPosition.top = parentPosition.top + $(this).height() + settings.sizeCorrectionYPadding - settings.offsetY;
		    }

		    toolDiv.css(newPosition);		},
		reposition : function(event) {
			var newPosition = {};
			var settings = $(this).data('tooltip.settings');
			var toolDiv = methods.gettooltip( this, settings );

			var parentPosition = $(this).offset();
			if( settings.tooltipParent != 'body' )
				parentPosition = $(this).position();

			if( settings.trackMouse )
			{
				if ( settings.trackMouseCentered )
					newPosition.left = event.pageX - toolDiv.outerWidth() / 2;
				else
					newPosition.left = event.pageX + settings.offsetY;

				if ( settings.location == 'top' )
					newPosition.top = event.pageY - toolDiv.outerHeight() + settings.offsetY;
				else
					newPosition.top = event.pageY + settings.offsetY;

			} else {
				switch( settings.location )
				{
					case 'top':
						newPosition = {
							left: parentPosition.left + settings.offsetX,
							top: parentPosition.top - toolDiv.outerHeight() + settings.offsetY
						};
						break;

					case 'bottom':
						var newLeft = parentPosition.left;

						newLeft += settings.offsetX;

						newPosition = {
							left: newLeft,
							top: parentPosition.top + $(this).outerHeight() + settings.offsetY
						};
						break;

					case 'bottom left':
						newPosition = {
							left: parentPosition.left + settings.offsetX - toolDiv.outerWidth() + $J(this).outerWidth(),
							top: parentPosition.top + $(this).outerHeight() + settings.offsetY
						};
						break;

					case 'mouse':
						newPosition = {
							left: event.pageX + settings.offsetX,
							top: event.pageY + settings.offsetY
						}

					default:
						console.log("Invalid location passed to v_tooltip: %s", settings.location);
				}
			}
			// Correct for window size
			if( settings.correctForScreenSize )
			{
				var rightEdge = newPosition.left + toolDiv.width();
				var windowRightEdge = $(window).width() - settings.sizeCorrectionXPadding + $(window).scrollLeft();
				var windowLeftEdge =  $(window).scrollLeft() + settings.sizeCorrectionXPadding;

				if( rightEdge > windowRightEdge )
					newPosition.left = windowRightEdge - toolDiv.width() - settings.sizeCorrectionXPadding;

				if( newPosition.left < windowLeftEdge )
					newPosition.left = windowLeftEdge;

				if ( newPosition.top < 0 )
					newPosition.top = parentPosition.top + $(this).height() + settings.sizeCorrectionYPadding - settings.offsetY;
			}

			toolDiv.css(newPosition);
		},
		show : function(event) {
			var settings = $(this).data('tooltip.settings') || {};
			
			if ( settings.disableOnTouchDevice && $(this ).data('inTouchEvent') )
			{
				return;
			}

			var toolDiv = methods.gettooltip( this, settings );

			if( toolDiv.is(':empty') )
				return;

			if( event.type == "click" && event.currentTarget != this )
				return;

			if( settings.suppressWhileToggled && $(this).hasClass('toggled') )
				return false;

			var tipElem = this;
			toolDiv.find( 'img' ).on( 'load', function() { jQuery.proxy(methods.updateposition, tipElem)() } );

			if( settings.preventDefault )
				event.preventDefault();

			if( settings.parentActiveCSSClass )
				$(this).addClass(settings.parentActiveCSSClass);

			if( settings.inheritParentMinWidth )
			{
				var parentWidth = $(this).outerWidth();
				var localPadding = toolDiv.outerWidth() - toolDiv.width();
				toolDiv.css({'min-width': + (parentWidth - localPadding) + "px"});
			}

			if( settings.fadeSpeed > 0 )
			{
				toolDiv.stop(true, true);
				toolDiv.fadeTo( settings.fadeSpeed, 1 );
			}
			else
				toolDiv.show();

			if( settings.allowHover )
			{
				if( settings.useClickEvent )
					toolDiv.bind('click.tooltip', jQuery.proxy(methods.show, this));
				else if( settings.useContextMenuEvent )
					toolDiv.bind('contextmenu.tooltip', jQuery.proxy(methods.show, this));
				else
					toolDiv.bind('mouseenter.tooltip', jQuery.proxy(methods.show, this));
				toolDiv.bind('mouseleave.tooltip', jQuery.proxy(methods.hide, this));
			}

			if( settings.trackMouse )
				$(this).bind('mousemove.tooltip', methods.reposition);
			else
				jQuery.proxy(methods.reposition, this)(event);

			if( settings.childActiveCSSClass )
			{
				toolDiv.css('opacity');
				toolDiv.addClass(settings.childActiveCSSClass);

			}

			toolDiv.css('pointer-events','auto');

			$(this).trigger('v_tooltip_shown', [ toolDiv ] );

		},
		hide : function(event) {
			var toolDiv = $(this).data('tooltip.element');
			var settings = $(this).data('tooltip.settings') || {};

			// the element may not have been created yet - in which case there is nothing to hide
			if ( !toolDiv || !toolDiv.length )
				return;


			if( event && event.type != 'click' )
			{
				// Moving between the click target and it's children
				if( event.relatedTarget && ( this == event.relatedTarget || this.contains(event.relatedTarget) ) )
					return;
				// Moving to the tooltip or one of it's children
				else if( event.relatedTarget && ( event.relatedTarget == toolDiv[0] || toolDiv[0].contains(event.relatedTarget ) ) )
					return;



			}

			if( settings.trackMouse )
				$(this).unbind('mousemove.tooltip');

			toolDiv.unbind('mouseenter.tooltip');
			toolDiv.unbind('mouseleave.tooltip');

			if( settings.parentActiveCSSClass )
				$(this).removeClass(settings.parentActiveCSSClass);


			if( settings.fadeSpeed > 0 && toolDiv.is(':visible') )
			{
				toolDiv.stop();
				toolDiv.fadeTo( settings.fadeSpeed, 0, function() { if( settings.destroyWhenDone ) methods.destroytooltip( toolDiv ) } );
			} else if( settings.childActiveCSSClass )
			{
				toolDiv.css('opacity');
				toolDiv.removeClass(settings.childActiveCSSClass);
				// Note: This callback isn't reliable, so we may end up junking up the dom with a few spare copies
				// Not a huge deal in most cases, but keep in mind if you're using this on pages which may exist for
				// long periods of time without reloading.
				if( settings.destroyWhenDone )
					toolDiv.on("transitionend", function() { methods.destroytooltip( toolDiv ) });
			}
			else
			{
				if( settings.destroyWhenDone )
					methods.destroytooltip( toolDiv );
			}
			if( settings.destroyWhenDone )
				$(this).removeData('tooltip.element');
			else
				toolDiv.css('pointer-events','none');

			$(this).trigger( 'v_tooltip_hidden' );
		},
		destroytooltip: function( toolDiv )
		{
			if ( toolDiv )
			{
				if ( $(toolDiv ).data('preserveContent') )
				{
					$( toolDiv.data( 'originalParent') ).append( $(toolDiv ).children().hide());
				}

				$(toolDiv).remove();
			}
		}
	};

	$.fn.v_tooltip = function( method ) {

		if ( methods[method] ) {
			return methods[method].apply( this, Array.prototype.slice.call( arguments, 1 ));
		} else if ( typeof method === 'object' || ! method ) {
			return methods.init.apply( this, arguments );
		} else {
			$.error( 'Method ' +  method + ' does not exist on jQuery.tooltip' );
		}

	};

})( jQuery );




Steam = {
	sm_bInitialized: false,
	sm_bUserInClient: false,
	sm_bUserInGameOverlay: false,
	sm_bUserInTenfootBrowser: false,

	BIsUserInSteamClient: function()
	{
		if ( !Steam.sm_bInitialized )
			Steam.Init();

		return Steam.sm_bUserInClient;
	},

	BIsUserInGameOverlay: function()
	{
		if ( !Steam.sm_bInitialized )
			Steam.Init();

		return Steam.sm_bUserInGameOverlay
	},

	BIsUserInSteamTenfootBrowser: function()
	{
		if ( !Steam.sm_bInitialized )
			Steam.Init();

		return Steam.sm_bUserInTenfootBrowser;
	},

	BIsUserInClientOrOverlay: function()
	{
		if ( !Steam.sm_bInitialized )
			Steam.Init();

		return Steam.sm_bUserInClient || Steam.sm_bUserInGameOverlay;
	},

	GetClientPackageVersion: function()
	{
		if ( !Steam.BIsUserInClientOrOverlay() )
			return 0;

		if ( typeof navigator != 'undefined' && navigator.userAgent )
		{
			var matches = navigator.userAgent.match( /Valve Steam [^\/]*\/([0-9]*)/ );
			if ( matches && matches.length == 2 )
				return matches[1];
		}

		return 0;
	},

	Init: function()
	{
		var fnCheckAgent = function( strUAMatch, strURLParam )
		{
			if ( window.location.href.match( '[?&]' + strURLParam + '=' ) )
				return true;

			if ( typeof navigator != 'undefined' && navigator.userAgent && navigator.userAgent.indexOf( strUAMatch ) != -1 )
				return true;

			return false;
		};

		Steam.sm_bUserInTenfootBrowser = fnCheckAgent( 'Valve Steam Tenfoot', 'force_tenfoot_client_view' );
		Steam.sm_bUserInGameOverlay = fnCheckAgent( 'Valve Steam GameOverlay', 'force_overlay_view' );
		Steam.sm_bUserInClient = Steam.sm_bUserInTenfootBrowser || fnCheckAgent( 'Valve Steam Client', 'force_client_view' );

		Steam.sm_bInitialized = true;
	},

	LinkInNewWindow: function( $A )
	{
		if ( Steam.BIsUserInSteamClient() && !Steam.BIsUserInSteamTenfootBrowser() )
			$A.attr( 'href', 'steam://openurl_external/' + $A.attr('href') );
		else
			$A.attr( 'target', '_blank' );
	}
};


// proto functions used to accept an id or an element.
// This can be used to migrate them to returning jquery instead of proto-wrapped element
function $JFromIDOrElement( elem )
{
	if ( elem instanceof jQuery )
		return elem;
	else if ( typeof elem == 'string' )
		return $J('#' + elem.replace( /\./, '\\.' ) );
	else
		return $J( elem );
}

/**	Show a popup dialog like confirm(), with two buttons.  Clicking ok resolves with done(), cancel or closing the window resolves with fail()
 *
 * @param strTitle			Title bar text
 * @param strDescription	Message text
 * @param strOKButton		Text to show on OK button (default "OK")
 * @param strCancelButton	Text to show on Cancel button (default "Cancel")
 * @param strSecondaryActionButton	Add a secondary ok button (three buttons total).  Resolves with done() like OK but passes 'SECONDARY' as argument to handler
 * @returns CModal
 */
function ShowConfirmDialog( strTitle, strDescription, strOKButton, strCancelButton, strSecondaryActionButton )
{
	if ( !strOKButton )
		strOKButton = 'OK';
	if ( !strCancelButton )
		strCancelButton = 'Cancel';

	var deferred = new jQuery.Deferred();
	var fnOK = function() { deferred.resolve( 'OK' ); };
	var fnSecondary = function() { deferred.resolve( 'SECONDARY' ); };
	var fnCancel = function( bWasCancelButton ) { deferred.reject( bWasCancelButton ); };

	var rgButtons = [];

	var $OKButton = _BuildDialogButton( strOKButton, true );
	$OKButton.click( fnOK );
	rgButtons.push( $OKButton );

	if ( strSecondaryActionButton )
	{
		var $SecondaryActionButton = _BuildDialogButton( strSecondaryActionButton, false, {strClassName: ' btn_darkblue_white_innerfade btn_medium' } );
		$SecondaryActionButton.click( fnSecondary );
		rgButtons.push( $SecondaryActionButton );
	}

	var $CancelButton = _BuildDialogButton( strCancelButton );
	$CancelButton.click( function() { fnCancel( true ); } );
	rgButtons.push( $CancelButton );

	var Modal = _BuildDialog( strTitle, strDescription, rgButtons, fnCancel );
	Modal.Show();

	_BindOnEnterKeyPressForDialog( Modal, deferred, fnOK );

	deferred.always( function() { Modal.Dismiss(); } );
	// attach the deferred's events to the modal
	deferred.promise( Modal );

	return Modal;
}

/**	Show a dialog with a single button, like alert().  Button click or closing the modal resolve deferred with done().
 *
 * @param strTitle			Title bar text
 * @param strDescription	Message text
 * @param strOKButton		Text on the OK button ("OK" by default)
 * @returns CModal
 */
function ShowAlertDialog( strTitle, strDescription, strOKButton )
{
	if ( !strOKButton )
		strOKButton = 'OK';

	var deferred = new jQuery.Deferred();
	var fnOK = function( bWasCancelButton ) { deferred.resolve( bWasCancelButton ); };

	var $OKButton = _BuildDialogButton( strOKButton );
	$OKButton.click( function() { fnOK( true ); } );

	var Modal = _BuildDialog( strTitle, strDescription, [ $OKButton ], fnOK );
	deferred.always( function() { Modal.Dismiss(); } );
	Modal.Show();

	_BindOnEnterKeyPressForDialog( Modal, deferred, fnOK );

	// attach the deferred's events to the modal
	deferred.promise( Modal );

	return Modal;

}

/**	Show a popup dialog.  Has no buttons.  Closing the dialog resolves deferred with done().
 *
 * @param strTitle			Title bar text
 * @param strDescription	Message text
 * @param rgModalParams		See CModal
 * @returns CModal
 */
function ShowDialog( strTitle, strDescription, rgModalParams )
{
	var deferred = new jQuery.Deferred();
	var fnOK = function() { deferred.resolve(); };

	var Modal = _BuildDialog( strTitle, strDescription, [], fnOK, rgModalParams );
	deferred.always( function() { Modal.Dismiss(); } );
	Modal.Show();

	// attach the deferred's events to the modal
	deferred.promise( Modal );

	return Modal;
}

/**
 * @returns CModal
 */
function ShowPromptDialog( strTitle, strDescription, strOKButton, strCancelButton, rgModalParams )
{
	if ( !strOKButton )
		strOKButton = 'OK';
	if ( !strCancelButton )
		strCancelButton = 'Cancel';

	var $Body = $J('<form/>');
	var $Input = $J('<input/>', {type: 'text', 'class': '' } );
	$Body.append( $J('<div/>', {'class': 'newmodal_prompt_description' } ).append( strDescription ) );
	$Body.append( $J('<div/>', {'class': 'newmodal_prompt_input gray_bevel for_text_input fullwidth' } ).append( $Input ) );

	var deferred = new jQuery.Deferred();
	var fnOK = function() { deferred.resolve( $Input.val() ); };
	var fnCancel = function() { deferred.reject(); };


	$Body.submit( function( event ) { event.preventDefault(); fnOK(); } );

	var elButtonLabel = $J( '<span/>' ).text( strOKButton );
	var $OKButton = $J('<button/>', {type: 'submit', 'class': 'btn_green_white_innerfade btn_medium' } ).append( elButtonLabel );
	$OKButton.click( fnOK );
	var $CancelButton = _BuildDialogButton( strCancelButton );
	$CancelButton.click( fnCancel );

	var Modal = _BuildDialog( strTitle, $Body, [ $OKButton, $CancelButton ], fnCancel );
	if( !rgModalParams || !rgModalParams.bNoPromiseDismiss )
		deferred.always( function() { Modal.Dismiss(); } );

	Modal.Show();

	$Input.focus();

	// attach the deferred's events to the modal
	deferred.promise( Modal );

	return Modal;
}

/**
 * @returns CModal
 */
function ShowPromptWithTextAreaDialog( strTitle, strDescription, strOKButton, strCancelButton, textAreaMaxLength )
{
	if ( !strOKButton )
		strOKButton = 'OK';
	if ( !strCancelButton )
		strCancelButton = 'Cancel';

	var $Body = $J('<form/>');
	var $TextArea = $J('<textarea/>', { 'class': 'newmodal_prompt_textarea' } );
	$TextArea.text( strDescription );
	if ( textAreaMaxLength )
	{
		$TextArea.attr( 'maxlength', textAreaMaxLength );
		$TextArea.bind( "keyup change",
			function()
			{
				var str = $J(this).val();
				var mx = parseInt($J(this).attr('maxlength'));
				if (str.length > mx)
				{
					$J(this).val(str.substr(0, mx));
					return false;
				}
			}
		);
	}
	$Body.append( $J('<div/>', {'class': 'newmodal_prompt_with_textarea gray_bevel fullwidth ' } ).append( $TextArea ) );

	var deferred = new jQuery.Deferred();
	var fnOK = function() { deferred.resolve( $TextArea.val() ); };
	var fnCancel = function() { deferred.reject(); };


	$Body.submit( function( event ) { event.preventDefault(); fnOK(); } );

	var elButtonLabel = $J( '<span/>' ).text( strOKButton );
	var $OKButton = $J('<button/>', {type: 'submit', 'class': 'btn_green_white_innerfade btn_medium' } ).append( elButtonLabel );
	$OKButton.click( fnOK );
	var $CancelButton = _BuildDialogButton( strCancelButton );
	$CancelButton.click( fnCancel );

	var Modal = _BuildDialog( strTitle, $Body, [ $OKButton, $CancelButton ], fnCancel );
	deferred.always( function() { Modal.Dismiss(); } );
	Modal.Show();

	$TextArea.focus();

	// attach the deferred's events to the modal
	deferred.promise( Modal );

	return Modal;
}

/**
 * @returns CModal
 */
function ShowBlockingWaitDialog( strTitle, strDescription )
{
	var deferred = new jQuery.Deferred();
	var fnOK = function() { deferred.resolve(); };

	var container = $J('<div/>', {'class': 'waiting_dialog_container'} );
	var throbber = $J('<div/>', {'class': 'waiting_dialog_throbber'} );
	container.append( throbber );
	container.append( strDescription );

	var Modal = _BuildDialog( strTitle, container, [], fnOK, { bExplicitDismissalOnly: true } );
	deferred.always( function() { Modal.Dismiss(); } );
	Modal.Show();

	// attach the deferred's events to the modal
	deferred.promise( Modal );

	return Modal;
}

function _BindOnEnterKeyPressForDialog( Modal, deferred, fnOnEnter )
{
	var fnOnKeyUp = function( event ) {
		if ( Modal.BIsActiveModal() && !event.isDefaultPrevented() && event.which == 13 && ( !event.target || event.target.nodeName != 'TEXTAREA' ) )
			fnOnEnter();
	};
	$J(document).on( 'keyup.SharedConfirmDialog', fnOnKeyUp );
	deferred.always( function() { $J(document).off( 'keyup.SharedConfirmDialog' ); } );
}

/**
 * @returns CModal
 * @private
 */
function _BuildDialog( strTitle, strDescription, rgButtons, fnOnCancel, rgModalParams )
{
	var $Dialog = $J('<div/>', {'class': 'newmodal'} );
	var $CloseButton = $J('<div/>', {'class': 'newmodal_close' });
	var $Header = ( $J('<div/>', {'class': 'newmodal_header' }) );
	$Header.append( $CloseButton ).append( $J('<div/>', {'class': 'ellipsis' } ).text( strTitle ) );
	$Header = $J('<div/>', {'class': 'newmodal_header_border'}).append( $Header );
	$Dialog.append( $Header );
	var $Content = $J('<div/>', {'class': 'newmodal_content' } );
	$Content.append( $J('<div/>').append( strDescription ) );

	if ( rgButtons.length > 0 )
	{
		var $Buttons = $J('<div/>', {'class': 'newmodal_buttons' } );
		$Content.append( $Buttons );
		for( var i = 0; i < rgButtons.length; i++ )
		{
			$Buttons.append( rgButtons[i] );
		}
	}

	$Dialog.append( $J('<div/>', {'class': 'newmodal_content_border' } ).append( $Content ) );

	if ( rgModalParams && rgModalParams.bExplicitDismissalOnly )
		$CloseButton.hide();

	var Modal = new CModal( $Dialog, rgModalParams );
	if ( fnOnCancel )
	{
		Modal.OnDismiss( fnOnCancel );
		$CloseButton.click( function() { Modal.Dismiss(); } );
	}

	// on responsive pages, the 'newmodal' element covers the whole viewable area (so that we can control scrolling
	// if the modal is very tall).  If the modal doesn't cover the whole area, we dismiss on clicks to this background
	//	area
	if ( Modal.m_fnBackgroundClick )
	{
		$Dialog.click( function(e) { if ( e.target == this ) Modal.m_fnBackgroundClick(); } );
	}

	Modal.SetRemoveContentOnDismissal( true );

	return Modal;
}

function _BuildDialogButton( strText, bActive, rgOptions )
{
	if ( !rgOptions )
		rgOptions = {};

	var strClassName = bActive ? 'btn_green_white_innerfade btn_medium' : 'btn_grey_white_innerfade btn_medium';
	if ( rgOptions.strClassName )
		strClassName = rgOptions.strClassName;

	var elButtonLabel = $J( '<span/>' ).html( strText );
	var elButton = $J('<div/>', {'class': strClassName } ).append( elButtonLabel );
	return elButton;
}

/* modal params:
	bExplicitDismissalOnly - by default, clicking outside of the modal dismisses it.  Set this to true to override that behavior
	bIgnoreResizeEvents - don't resize the modal when the window resizes
 */

function CModal( $Content, rgParams )
{
	rgParams = rgParams || {};

	this.m_$Content = $Content;
	this.m_bVisible = false;

	this.m_bIgnoreResizeEvents = rgParams.bIgnoreResizeEvents;
	this.m_fnSizing = null;
	this.m_fnBackgroundClick = null;
	this.m_fnOnResize = null;
	this.m_bDismissOnBackgroundClick = !rgParams.bExplicitDismissalOnly;
	this.m_nMaxWidth = 0;
	this.m_nMaxHeight = 0;

	this.m_fnOnDismiss = null;
	this.m_bRemoveContentOnDismissal = false;

	this.m_nInitialOffsetTop = $J(document.body).scrollTop();
	this.m_nInitialOffsetLeft = $J(document.body).scrollLeft();
	this.m_$Content.css( 'position', 'fixed' );
	this.m_$Content.css( 'z-index', 1000 );

	this.m_$StandardContent = null;
	this.m_$SizedContent = null;
	this.OnContentChanged();	//this will look for StandardContent and SizedContent in the modal body


	var _modal = this;
	this.m_fnBackgroundClick = function() { if ( _modal.BIsActiveModal() && _modal.m_bDismissOnBackgroundClick ) { _modal.Dismiss(); } };
	this.m_fnOnEscapeKeyPress = function( event ) { if ( _modal.BIsActiveModal() && event.which == 27 ) _modal.m_fnBackgroundClick(); };
	this.m_fnSizing = function() { _modal.AdjustSizing(); };

	/* make sure the content is parented correctly */
	$J(document.body).append( this.m_$Content );
}

CModal.prototype.OnDismiss = function( fn )
{
	this.m_fnOnDismiss = fn;
};

CModal.prototype.OnResize = function( fn )
{
	this.m_fnOnResize = fn;
};

/**
 * @returns jQuery
 */
CModal.prototype.GetContent = function ()
{
	return this.m_$Content;
};

CModal.prototype.GetBoundOnResizeEvent = function()
{
	// in case someone outside needs to tell the modal to resize on certain events (eg images or iframes loading in the modal)
	return this.m_fnSizing;
};

CModal.prototype.OnContentChanged = function()
{
	// make sure we're holding the right elements
	this.m_$StandardContent = this.m_$Content.find( '.newmodal_content' );
	if ( !this.m_$StandardContent.length )
		this.m_$StandardContent = this.m_$Content;
	this.m_$SizedContent = this.m_$Content.find( '.newmodal_sized_content' );
};

CModal.prototype.SetRemoveContentOnDismissal = function ( bRemoveContent )
{
	this.m_bRemoveContentOnDismissal = bRemoveContent;
};

CModal.prototype.SetDismissOnBackgroundClick = function ( bDismissOnBackgroundClick )
{
	this.m_bDismissOnBackgroundClick = bDismissOnBackgroundClick;
};

CModal.prototype.SetMaxWidth = function ( nMaxWidth )
{
	this.m_nMaxWidth = nMaxWidth;
	if ( this.m_bVisible )
		this.AdjustSizing();
};

CModal.prototype.SetMaxHeight = function ( nMaxHeight )
{
	this.m_nMaxHeight = nMaxHeight;
	if ( this.m_bVisible )
		this.AdjustSizing();
};

CModal.prototype.AdjustSizing = function( duration )
{
	if ( !this.m_$Content )
		return;

	var bResponsiveScreen = window.UseTouchFriendlyMode && UseTouchFriendlyMode();

	var nViewportWidth = document.compatMode === 'BackCompat' ? document.body.clientWidth : $J(window).width();
	var nViewportHeight = document.compatMode === 'BackCompat' ? document.body.clientHeight : $J(window).height();

	var nMaxWidth = Math.max( nViewportWidth - ( bResponsiveScreen? 24 : 80 ), bResponsiveScreen ? 200 : 500 );
	var nMaxHeight = Math.floor( nViewportHeight - 120 );

	if ( this.m_nMaxWidth && nMaxWidth > this.m_nMaxWidth )
	{
		nMaxWidth = this.m_nMaxWidth;
	}

	if ( this.m_nMaxHeight && nMaxHeight > this.m_nMaxHeight )
	{
		nMaxHeight = this.m_nMaxHeight;
	}

	// if the modal has a 'newmodal_sized_content' div, it wants to be the max height, so set it now
	//	before we compute height	( "- 18" is a fudge for a possible horizontal scrollbar )
	this.m_$SizedContent.css( 'min-height', ( nMaxHeight - 18 ) + 'px' );
	if ( this.m_fnOnResize )
	{
		this.m_fnOnResize( nMaxWidth - 40, nMaxHeight );
	}

	if ( !duration )
	{
		// set sizes right away so we can calculate a good left and top
		this.m_$Content.css( 'max-width',  nMaxWidth + 'px' );
		if ( !bResponsiveScreen )
		{
			this.m_$StandardContent.css( 'max-height',  nMaxHeight + 'px' );
		}
		else
		{
			this.m_$StandardContent.css( 'max-height', '' );
		}
	}

	var nContentWidth = this.m_$Content.width();
	var nContentHeight = this.m_$Content.height();
	var nLeft = Math.max( Math.floor( ( nViewportWidth - nContentWidth ) / 2 ), 12 );
	var nTop = Math.max( Math.floor( ( nViewportHeight - nContentHeight ) / 2 ), 12 );

	if ( bResponsiveScreen )
	{
		nLeft += this.m_nInitialOffsetLeft;
		nTop += this.m_nInitialOffsetTop;
		this.m_$Content.css( 'position', 'absolute' );
	}
	else
	{
		this.m_$Content.css( 'position', 'fixed' );
	}

	if ( duration )
	{
		this.m_$Content.animate( { 'max-width': nMaxWidth, left: nLeft, top: nTop }, duration );
		this.m_$StandardContent.animate( {'max-height': nMaxHeight }, duration );
	}
	else
	{
		this.m_$Content.css( 'left', nLeft );
		this.m_$Content.css( 'top', nTop );
	}
};

CModal.prototype.Show = function()
{
	if ( this.m_bVisible )
		return;

	CModal.ShowModalBackground();

	if ( !this.m_bIgnoreResizeEvents )
	{
		$J(window).on( 'resize', null, this.m_fnSizing );
	}
	CModal.s_$Background.on( 'click.CModal', this.m_fnBackgroundClick );
	$J(document).on( 'keyup.CModal', this.m_fnOnEscapeKeyPress );

	this.AdjustSizing();

	this.m_$Content.show();

	// resize as any child image elements load in.
	this.m_$Content.find('img').load( this.m_fnSizing );

	this.m_bVisible = true;
	CModal.PushActiveModal( this );
};

CModal.prototype.Dismiss = function()
{
	if ( !this.m_bVisible )
		return;

	this.m_bVisible = false;

	this.m_$Content.hide();

	if ( !this.m_bIgnoreResizeEvents )
	{
		$J(window).off( 'resize', null, this.m_fnSizing );
	}

	if ( this.m_fnOnDismiss )
		this.m_fnOnDismiss();

	if ( this.m_bRemoveContentOnDismissal )
	{
		this.m_$Content.remove();
		this.m_$Content = null;
	}

	CModal.PopActiveModal( this );
	if ( !CModal.s_rgModalStack.length )
	{
		CModal.s_$Background.off( 'click.CModal', this.m_fnBackgroundClick );
		$J(document).off( 'keyup.CModal', this.m_fnOnEscapeKeyPress );
		CModal.HideModalBackground();
	}
};

CModal.prototype.BIsActiveModal = function()
{
	return CModal.s_rgModalStack.length && CModal.s_rgModalStack[ CModal.s_rgModalStack.length - 1 ] == this;
};

/* static */
CModal.ShowModalBackground = function()
{
	if ( !CModal.s_$Background )
	{
		CModal.s_$Background = $J('<div/>', {'class': 'newmodal_background'});
		CModal.s_$Background.css( 'opacity', 0 );
		$J(document.body).append( CModal.s_$Background );
	}
	CModal.s_$Background.stop();	// stop running animations
	CModal.s_$Background.fadeTo( 200, 0.8 );
};

CModal.HideModalBackground = function()
{
	if ( CModal.s_$Background )
	{
		CModal.s_$Background.stop();	// stop running animations
		CModal.s_$Background.fadeOut( 200, 0 );
	}
};

CModal.s_rgModalStack = [];
CModal.GetActiveModal = function()
{
	if ( CModal.s_rgModalStack.length )
		return CModal.s_rgModalStack[CModal.s_rgModalStack.length-1];
	else
		return null;
};
CModal.DismissActiveModal = function()
{
	if ( CModal.s_rgModalStack.length )
		CModal.s_rgModalStack[CModal.s_rgModalStack.length-1].Dismiss();
};

CModal.PushActiveModal = function( Modal )
{
	for ( var i = 0; i < CModal.s_rgModalStack.length; i++ )
	{
		// push below background
		CModal.s_rgModalStack[i].m_$Content.css( 'z-index', 899 );
	}
	CModal.s_rgModalStack.push( Modal );
};

CModal.PopActiveModal = function( Modal )
{
	for ( var i = 0; i < CModal.s_rgModalStack.length; i++ )
	{
		if ( CModal.s_rgModalStack[i] == Modal )
		{
			CModal.s_rgModalStack.splice( i, 1 );
			break;
		}
	}

	if ( CModal.s_rgModalStack.length )
		CModal.s_rgModalStack[ CModal.s_rgModalStack.length - 1 ].m_$Content.css( 'z-index', 1000 );
};

// this will set the right headers for a cross-domain request to community
function GetDefaultCommunityAJAXParams( path, method )
{
	var rgParams = { url: 'http://steamcommunity.com/' + path };
	if ( method )
		rgParams.type = method;

	// if this js file was hosted off the store, add CORS request headers
	if ( window.location.href.indexOf( 'http://steamcommunity.com/' ) != 0 )
	{
		rgParams.crossDomain = true;
		rgParams.xhrFields = { withCredentials: true };
	}
	return rgParams;
}

// spped of the miniprofile fading in and out
var MINIPROFILE_ANIM_SPEED = 150;
// how long the mouse must remain over an element before we'll make an AJAX call
var MINIPROFILE_DELAY_BEFORE_AJAX = 100;
// the delay before we'll show the hover, must be longer than DELAY_BEFORE_AJAX
var MINIPROFILE_DELAY_BEFORE_SHOW = 250;

function CDelayedAJAXData( strURL, msDelayBeforeAJAX )
{
	this.m_$Data = null;
	this.m_bAJAXFailed = false;
	this.m_timerDelayedAJAX = null;
	this.m_bAJAXRequestMade = false;
	this.m_msDelayBeforeAJAX = msDelayBeforeAJAX;
	this.m_strURL = strURL;

	this.m_fnOnAJAXComplete = null;
}

CDelayedAJAXData.prototype.GetAJAXParams = function()
{
	return GetDefaultCommunityAJAXParams( this.m_strURL, 'GET' );
};

CDelayedAJAXData.prototype.QueueAjaxRequestIfNecessary = function()
{
	if ( !this.m_$Data && !this.m_bAJAXRequestMade )
	{
		var _this = this;
		this.m_timerDelayedAJAX = window.setTimeout( function() {
			_this.m_timerDelayedAJAX = null;
			_this.m_bAJAXRequestMade = true;
			var rgAJAXParams = _this.GetAJAXParams();
			$J.ajax( rgAJAXParams )
				.done( function(data) {
					_this.m_$Data = $J(data);
					if ( _this.m_fnOnAJAXComplete )
						_this.m_fnOnAJAXComplete();
				}).fail( function() {
					_this.m_bAJAXFailed = true;
				});
		}, this.m_msDelayBeforeAJAX );
	}
};

CDelayedAJAXData.prototype.CancelAJAX = function()
{
	if ( this.m_timerDelayedAJAX )
		window.clearTimeout( this.m_timerDelayedAJAX );

	this.m_fnOnAJAXComplete = null;
};

CDelayedAJAXData.prototype.RunWhenAJAXReady = function( fnOnReady )
{
	if ( this.m_$Data )
		fnOnReady();
	else if ( !this.m_bAJAXFailed )
	{
		this.m_fnOnAJAXComplete = fnOnReady;
		this.QueueAjaxRequestIfNecessary();
	}
	// if ajax failed we will not call fnOnReady
};

CDelayedAJAXData.prototype.Show = function( $HoverContent )
{
	$HoverContent.children().detach();
	$HoverContent.append( this.m_$Data );
};

function InitMiniprofileHovers()
{
	var $Hover = $J('<div/>', {'class': 'miniprofile_hover'} );
	var $HoverContent = $J('<div/>', {'class': 'miniprofile_hover_inner shadow_content'} );

	var $HoverArrowLeft = $J('<div/>', {'class': 'hover_arrow left miniprofile_arrow'} );
	$HoverArrowLeft.append( '<div class="miniprofile_arrow_inner"></div>' );
	var $HoverArrowRight = $J('<div/>', {'class': 'hover_arrow right miniprofile_arrow'} );
	$HoverArrowRight.append( '<div class="miniprofile_arrow_inner"></div>' );

	$Hover.append( $J('<div class="shadow_ul"></div><div class="shadow_top"></div><div class="shadow_ur"></div><div class="shadow_left"></div><div class="shadow_right"></div><div class="shadow_bl"></div><div class="shadow_bottom"></div><div class="shadow_br"></div>'), $HoverContent, $HoverArrowLeft, $HoverArrowRight );

	$Hover.hide();
	$J(document.body).append( $Hover );

	var fnDataFactory = function( key ) { return new CDelayedAJAXData( 'miniprofile/' + key, MINIPROFILE_DELAY_BEFORE_AJAX ); };

	var rgCallbacks = BindAJAXHovers( $Hover, $HoverContent, {
		fnDataFactory: fnDataFactory,
		fnPositionHover: PositionMiniprofileHover,
		strDataName: 'miniprofile',
		strURLMatch: 'miniprofile'
	}  );
}

function _RegisterAJAXHoverHideFunction( fnHide )
{
	if ( typeof g_rgfnHideAJAXHover == 'undefined' )
	{
		g_rgfnHideAJAXHover = [];
		$J(window).blur( HideAJAXHovers );
	}

	g_rgfnHideAJAXHover.push( fnHide );
}

function HideAJAXHovers()
{
	if ( typeof g_rgfnHideAJAXHover != 'undefined' )
	{
		for ( var i = 0; i < g_rgfnHideAJAXHover.length; i++ )
			g_rgfnHideAJAXHover[i]();
	}
}

function BindAJAXHovers( $Hover, $HoverContent, oParams )
{
	var fnDataFactory = oParams.fnDataFactory;
	var fnPositionHover = oParams.fnPositionHover || PositionMiniprofileHover;
	var strDataName = oParams.strDataName;
	var strURLMatch = oParams.strURLMatch;
	var fnReadKey = function( $Element ) { return $Element.data( strDataName ); };
	if ( oParams.fnReadKey )
		fnReadKey = oParams.fnReadKey;
	var strSelector = oParams.strSelector || '[data-' + strDataName + ']';
	var nDelayBeforeShow = oParams.nDelayBeforeShow || MINIPROFILE_DELAY_BEFORE_SHOW;

	// indexed by accountid
	var rgHoverData = {};
	var HoverTarget = null;
	var timerHover = null;

	var fnOnHover = function( $Target, key ) {

		var bHoverVisible = ( $Hover.css('display') != 'none' );

		var HoverData = rgHoverData[key];
		if ( !HoverData )
		{
			HoverData = rgHoverData[key] = fnDataFactory( key );
		}

		if ( HoverTarget == HoverData && bHoverVisible )
		{
			//really only want to do this while fading out
			$Hover.stop();
			fnPositionHover( $Hover, $Target );
			$Hover.show();	// PositionMiniprofile toggles visibility
			$Hover.fadeTo( MINIPROFILE_ANIM_SPEED, 1.0 );
		}
		else if ( !timerHover || HoverData != HoverTarget )
		{
			// this is the new target
			if ( HoverTarget && HoverTarget != HoverData )
				HoverTarget.CancelAJAX();
			HoverTarget = HoverData;

			if ( timerHover )
			{
				window.clearTimeout( timerHover );
				timerHover = null;
			}

			HoverData.QueueAjaxRequestIfNecessary();

			timerHover = window.setTimeout( function() {
				window.clearTimeout( timerHover );
				timerHover = null;

				HoverData.RunWhenAJAXReady( function() {
					HoverData.Show( $HoverContent );
					$Hover.stop();
					$Hover.css( 'opacity', '' ); //clean up jquery animation
					fnPositionHover( $Hover, $Target );
					$Hover.fadeIn( MINIPROFILE_ANIM_SPEED );
				} );
			}, nDelayBeforeShow );
		}
	};

	var fnCancelHover = function( key )
	{
		var bHoverVisible = ( $Hover.css('display') != 'none' );

		if ( key )
		{
			var HoverData = rgHoverData[key];
			if ( HoverData )
			{
				HoverData.CancelAJAX();
			}
		}

		if ( timerHover )
		{
			window.clearTimeout( timerHover );
			timerHover = null;
		}

		if ( bHoverVisible )
		{
			$Hover.stop();
			$Hover.fadeOut( MINIPROFILE_ANIM_SPEED );
		}
	};

	var strEventNamespace = 'AjaxHover' + strDataName;
	$J(document ).on('mouseenter.' + strEventNamespace, strSelector, function() {
		var $Target = $J(this);
		fnOnHover( $Target, fnReadKey( $Target) );
	} );
	$J(document ).on('click.' + strEventNamespace + ' mouseleave.' + strEventNamespace, strSelector, fnCancelHover );

	// register this hover so HideAJAXHovers() can hide it when invoked
	_RegisterAJAXHoverHideFunction( fnCancelHover );

	return {
		fnCancelHover: fnCancelHover
	};
}

function PositionMiniprofileHover( $Hover, $Target, oParams )
{
	if ( !oParams )
		oParams = {};
	var bPreferRightSide = oParams.bPreferRightSide || false;
	var nPxArrowOverlap = ( oParams.nPxArrowOverlap != undefined ) ? oParams.nPxArrowOverlap : 2;

	$Hover.css( 'visibility', 'hidden' );
	$Hover.show();

	var offset = $Target.offset();
	$Hover.css( 'left', offset.left + 'px' );
	$Hover.css( 'top', offset.top + 'px');

	var $HoverBox = $Hover.children( '.shadow_content' );
	if ( !$HoverBox.length )
		$HoverBox = $J( $Hover.children()[0] );

	var $HoverArrowLeft = $Hover.children( '.hover_arrow.left' );
	var $HoverArrowRight = $Hover.children( '.hover_arrow.right' );

	var nWindowScrollTop = $J(window).scrollTop();
	var nWindowScrollLeft = $J(window).scrollLeft();
	var nViewportWidth = $J(window).width();
	var nViewportHeight = $J(window).height();

		var $HoverArrow = $HoverArrowRight;
	var nBoxRightViewport = ( offset.left - nWindowScrollLeft ) + $Target.outerWidth() + $HoverBox.width() + 14;
	var nSpaceRight = nViewportWidth - nBoxRightViewport;
	var nSpaceLeft = offset.left - $Hover.width();
	if ( ( ( nSpaceLeft > 0 || nSpaceLeft > nSpaceRight ) && !bPreferRightSide ) || ( bPreferRightSide && nSpaceRight < 14 && nSpaceLeft > nSpaceRight ) )
	{
				$Hover.css( 'left', ( offset.left - $Hover.width() + nPxArrowOverlap + 3 ) + 'px' );
		$HoverArrowLeft.hide();
		$HoverArrowRight.show();
	}
	else
	{
				$Hover.css( 'left', ( offset.left + $Target.outerWidth() - nPxArrowOverlap ) + 'px' );
		$HoverArrow = $HoverArrowLeft;
		$HoverArrowLeft.show();
		$HoverArrowRight.hide();
	}

	var nTopAdjustment = 0;

			if ( $Target.height() < 48 )
		nTopAdjustment = Math.floor( $Target.height() / 2 ) - 24;
	var nDesiredHoverTop = offset.top - 15 + nTopAdjustment;
	$Hover.css( 'top', nDesiredHoverTop + 'px' );

	// see if the hover is cut off by the bottom of the window, and bump it up if neccessary
	var nTargetTopViewport = ( offset.top - nWindowScrollTop ) + nTopAdjustment;
	if ( nTargetTopViewport + $HoverBox.height() + 35 > nViewportHeight )
	{
		var nViewportAdjustment = ( $HoverBox.height() + 35 ) - ( nViewportHeight - nTargetTopViewport );

		// if the hover has the "in-game" block at the bottom, we need to have more space at the bottom of the hover
		//	so that the arrow will appear in the blue part of the hover.  This means the game info may be off-screen below.
		var bHaveInGameInfo = $HoverBox.find('.miniprofile_ingame').length > 0;
		var nHoverBoxBottomMinimum = ( bHaveInGameInfo ? 78 : 24 );	// the minimum amount of space we need below the arrow
		nViewportAdjustment = Math.min( $HoverBox.height() - nHoverBoxBottomMinimum, nViewportAdjustment );

		var nViewportAdjustedHoverTop = offset.top - nViewportAdjustment;
		$Hover.css( 'top', nViewportAdjustedHoverTop + 'px' );

		// arrow is normally offset 30pixels.  we move it down the same distance we moved the hover up, so it is "fixed" to where it was initially
		$HoverArrow.css( 'top', ( 30 + nDesiredHoverTop - nViewportAdjustedHoverTop ) + 'px' );
	}
	else
	{
		$HoverArrow.css( 'top', '' );
	}

	$Hover.hide();
	$Hover.css( 'visibility', '' );
}


/* Emoticon hovers */

function CEmoticonDelayedAJAXData( strEmoticonName, msDelayBeforeAJAX )
{
	CDelayedAJAXData.apply( this, [ 'economy/emoticonhover/' + strEmoticonName + '/jsonp.js', msDelayBeforeAJAX ]);
	this.m_strEmoticonName = strEmoticonName;
}

// subclass CDelayedAJAXData so we can request via JSONP
CEmoticonDelayedAJAXData.prototype = new CDelayedAJAXData;
CEmoticonDelayedAJAXData.prototype.constructor = CEmoticonDelayedAJAXData;

CEmoticonDelayedAJAXData.prototype.GetAJAXParams = function()
{
	return {
		url: 'http://community.edgecast.steamstatic.com/' + this.m_strURL,
		dataType: 'jsonp',
		jsonpCallback: 'OnLoadEmoticon_' + this.m_strEmoticonName,	//consistent name for cachability
		cache: true,
		data: {l: 'english' }
	}
};

function InitEmoticonHovers()
{
	var $Hover = $J('<div/>', {'class': 'emoticon_hover'} );
	var $HoverContent = $J('<div/>', {'class': 'emoticon_hover_content'} );
	$Hover.append( $HoverContent, $J('<div/>', {'class': 'hover_arrow left emoticon_hover_arrow' } ), $J('<div/>', {'class': 'hover_arrow right emoticon_hover_arrow' } ) );
	$Hover.hide();

	var fnOneTimeEmoticonSetup = function() {
		$J(document.body).append( $Hover );
	};

	var fnReadKey = function ( $Element ) {
		if ( $Element.data('emoticon') )
		{
			return $Element.data('emoticon');
		}
		else if ( $Element.attr( 'src' ) )
		{
			var rgMatches = $Element.attr( 'src' ).match( 'emoticon/(.*)$' );
			if ( rgMatches && rgMatches[1] )
			{
				var strEmoticon = rgMatches[1];
				if ( strEmoticon.length > 1 )
				{
					if ( strEmoticon[0] == ':' )
						strEmoticon = strEmoticon.substr( 1 );
					if ( strEmoticon[ strEmoticon.length - 1 ] == ':' )
						strEmoticon = strEmoticon.substr( 0, strEmoticon.length - 1 );
				}
				return strEmoticon;
			}
		}

		return null;
	};

	var fnDataFactory = function( key )	{
		if ( fnOneTimeEmoticonSetup )
		{
			fnOneTimeEmoticonSetup();
			fnOneTimeEmoticonSetup = null;
		}

		return new CEmoticonDelayedAJAXData( key, 50 );
	};

	var rgCallbacks = BindAJAXHovers( $Hover, $HoverContent, {
		fnDataFactory: fnDataFactory,
		fnPositionHover: function( $Hover, $Target ) {
			PositionMiniprofileHover( $Hover, $Target, {
				bPreferRightSide: true,
				nPxArrowOverlap: 0
			} );
			//slide it down a little for emoticon option popup
			if ( $Target.hasClass('emoticon_option') )
				$Hover.css( 'top', parseInt( $Hover.css('top') ) + 5 );
		},
		fnReadKey: fnReadKey,
		strSelector: 'img.emoticon',
		strURLMatch: 'emoticonhover',
		nDelayBeforeShow: 50
	} );

	window.DismissEmoticonHover = rgCallbacks.fnCancelHover;
}

function V_EscapeRegExp( str )
{
	return str.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' );
}

function V_EscapeHTML( str )
{
	return String(str).replace( /&/g, '&amp;' ).replace( /["]/g, '&quot;' ).replace( /[']/g, '&#39;' ).replace( /</g, '&lt;').replace( />/g, '&gt;');
}

function v_trim( str )
{
	if ( str.trim )
		return str.trim();
	else
	{
		return str.replace(/^\s+/, '').replace(/\s+$/, '');
	}
}

function V_ParseJSON( str )
{
	if ( typeof JSON == 'object' && JSON.parse )
		return JSON.parse( str );	// built-in / json2.js
	else
		str.evalJSON();				// prototype
}

function V_ToJSON( object )
{
	if ( typeof JSON == 'object' && JSON.stringify )
		return JSON.stringify( object );	// built-in / json2.js
	else
		Object.toJSON( object );				// prototype
}

function V_IsJSON( str )
{
	try
	{
		if( typeof JSON == 'object' && JSON.parse )
		{
			var o = JSON.parse(str);
			if ( o !== null )
				return true;

		} else {
			return str.isJSON();
		}
	}
	catch (e) { }
	return false;
}


function V_GetCookie( strCookieName )
{
	var rgMatches = document.cookie.match( '(^|; )' + strCookieName + '=([^;]*)' );
	if ( rgMatches && rgMatches[2] )
		return rgMatches[2];
	else
		return null;
}

function V_SetCookie( strCookieName, strValue, expiryInDays, path )
{
	if ( !path )
		path = '/';

	var strDate = '';

	if( typeof expiryInDays != 'undefined' && expiryInDays )
	{
		var dateExpires = new Date();
		dateExpires.setTime( dateExpires.getTime() + 1000 * 60 * 60 * 24 * expiryInDays );
		strDate = '; expires=' + dateExpires.toGMTString();
	}

	document.cookie = strCookieName + '=' + strValue + strDate + ';path=' + path;
}

function _GetStorageFromCookie()
{
	var oStorage = {};

	var strStorageJSON = V_GetCookie( 'storage' );
	if ( strStorageJSON )
	{
		try {
			oStorage = V_ParseJSON(decodeURIComponent(strStorageJSON));
		}
		catch (e) {
			oStorage = {};
		}
	}

	return oStorage;
}

function BInsideIFrame()
{
	try
	{
		return window.self !== window.top;
	}
	catch( e )
	{
		return true;
	}
}

function SetValueLocalStorage( strPreferenceName, value )
{
	if ( !BInsideIFrame() && window.localStorage )
	{
		window.localStorage[strPreferenceName] = value;
	}
	else
	{
		var oStorage = _GetStorageFromCookie();

		oStorage[strPreferenceName] = value;

		V_SetCookie( 'storage', encodeURIComponent( V_ToJSON( oStorage ) ), 365 )
	}
}

function UnsetValueLocalStorage( strPreferenceName )
{
	if ( !BInsideIFrame() && window.localStorage )
	{
		delete window.localStorage[strPreferenceName];
	}
	else
	{
		var oStorage = _GetStorageFromCookie();

		delete oStorage[strPreferenceName];

		V_SetCookie( 'storage', encodeURIComponent( V_ToJSON( oStorage ) ), 365 )
	}
}

function GetValueLocalStorage( strPreferenceName, defaultValue )
{
	if ( !BInsideIFrame() && window.localStorage )
	{
		return window.localStorage[strPreferenceName] || defaultValue;
	}
	else
	{
		var oStorage = _GetStorageFromCookie();

		return oStorage[strPreferenceName] || defaultValue;
	}
}

function DynamicLink_PlayYouTubeVideoInline( elem, videoid )
{
	var el = $J(elem);
	var youtubeurl = location.protocol + '//www.youtube.com/embed/' + videoid + '?showinfo=0&autohide=1&fs=1&hd=1&modestbranding=1&rel=0&showsearch=0&wmode=direct&autoplay=1';
	var wrapper = $J( '<div/>', { 'class': 'dynamiclink_youtubeviewvideo' } );
	var embed_wrapper = $J( '<div/>', { 'class' : 'dynamiclink_youtubeviewvideoembedded', 'frameborder' : '0' } );
	var iframeContent = $J( '<iframe/>', { 'frameborder' : '0', src: youtubeurl, 'allowfullscreen': '' } );
	if ( el.length )
	{
		embed_wrapper.append( iframeContent );
		wrapper.append( embed_wrapper );
		el.after( wrapper );
		el.remove();
	}
}

function DynamicLink_PlayVimeoVideoInline( elem, videoid )
{
	var el = $J(elem);
	var videourl = 'https://player.vimeo.com/video/' + videoid + '?badge=0&autopause=0&autoplay=1&player_id=0';
	var wrapper = $J( '<div/>', { 'class': 'dynamiclink_youtubeviewvideo' } );
	var embed_wrapper = $J( '<div/>', { 'class' : 'dynamiclink_youtubeviewvideoembedded', 'frameborder' : '0' } );
	var iframeContent = $J( '<iframe/>', { 'frameborder' : '0', src: videourl, webkitallowfullscreen : '', mozallowfullscreen : '', allowfullscreen : '' } );
	if ( el.length )
	{
		embed_wrapper.append( iframeContent );
		wrapper.append( embed_wrapper );
		el.after( wrapper );
		el.remove();
	}
}

function DynamicLink_ShowSketchfabModelInline( elem, details )
{
	var url = "https://sketchfab.com/models/" + details.modelid + "/embed?autostart=1";
	var el = $J(elem);
	var wrapper = $J( '<div/>', { 'class' : 'dynamiclink_sketchfabmodelembedded', 'frameborder' : '0' } );
	var iframeContent = $J( '<iframe/>', { 'frameborder' : '0', "mozallowfullscreen" : true, "webkitallowfullscreen" : true, src: url } );
	if ( el.length )
	{
		wrapper.append( iframeContent );
		el.after( wrapper );
		el.remove();
	}
}

function ReplaceDynamicLink( id, strHTML )
{
	var el = $J('#'+id);
	if ( el.length && strHTML.length > 0 )
	{
		el.after( strHTML );
		el.remove();
	}
}



function CScrollOffsetWatcher( el, fnCallback )
{
	this.m_$Element = $J(el);
	this.nOffsetTop = this.m_$Element.offset().top;
	this.nBufferHeight = 500;

	this.nOffsetTopTrigger = this.nOffsetTop - this.nBufferHeight;

	this.fnOnHit = fnCallback;

	CScrollOffsetWatcher.RegisterWatcher( this );
}

CScrollOffsetWatcher.prototype.SetBufferHeight = function( nHeight )
{
	this.nBufferHeight = nHeight;
	this.Recalc();
};

CScrollOffsetWatcher.prototype.Recalc = function()
{
	this.nOffsetTop = this.m_$Element.offset().top;
	this.nOffsetTopTrigger = this.nOffsetTop - this.nBufferHeight;
};

CScrollOffsetWatcher.sm_rgWatchers = [];
CScrollOffsetWatcher.m_nTimeoutInitialLoad = 0;
CScrollOffsetWatcher.RegisterWatcher = function( Watcher )
{
	var bHadWatchers = CScrollOffsetWatcher.sm_rgWatchers.length > 0;

	// keep the list sorted by offset trigger
	var iInsertionPoint;
	for( iInsertionPoint = CScrollOffsetWatcher.sm_rgWatchers.length; iInsertionPoint > 0 ; iInsertionPoint-- )
	{
		if ( Watcher.nOffsetTopTrigger > CScrollOffsetWatcher.sm_rgWatchers[iInsertionPoint - 1].nOffsetTopTrigger )
			break;
	}
	CScrollOffsetWatcher.sm_rgWatchers.splice( iInsertionPoint, 0, Watcher );

	if ( !bHadWatchers )
	{
		$J(window).on( 'scroll.ScrollOffsetWatcher', CScrollOffsetWatcher.OnScroll );

		var nRecalcTimer = 0;
		$J(window).on( 'resize.ScrollOffsetWatcher', function() {
			if ( nRecalcTimer )
				window.clearTimeout( nRecalcTimer );
			nRecalcTimer = window.setTimeout( CScrollOffsetWatcher.ForceRecalc, 500 );
		} );
	}

	// use a 1ms timeout to roll these together as much as possible on page load
	if ( !CScrollOffsetWatcher.m_nTimeoutInitialLoad )
		CScrollOffsetWatcher.m_nTimeoutInitialLoad = window.setTimeout( function() { CScrollOffsetWatcher.OnScroll(); CScrollOffsetWatcher.m_nTimeoutInitialLoad = 0; }, 1 );
};

CScrollOffsetWatcher.ForceRecalc = function()
{
	for ( var i = 0; i < CScrollOffsetWatcher.sm_rgWatchers.length; i++ )
	{
		CScrollOffsetWatcher.sm_rgWatchers[i].Recalc();
	}

	CScrollOffsetWatcher.OnScroll();
};

CScrollOffsetWatcher.OnScroll = function()
{
	var supportPageOffset = window.pageYOffset !== undefined;
	var isCSS1Compat = ((document.compatMode || "") === "CSS1Compat");

	var nScrollY = supportPageOffset ? window.pageYOffset : isCSS1Compat ? document.documentElement.scrollTop : document.body.scrollTop;
	var nOffsetBottom = nScrollY + window.innerHeight;

	var cCompletedWatchers = 0;
	for( var i = 0; i < CScrollOffsetWatcher.sm_rgWatchers.length; i++ )
	{
		var Watcher = CScrollOffsetWatcher.sm_rgWatchers[i];
		if ( nOffsetBottom > Watcher.nOffsetTopTrigger )
		{
			// make sure the page hasn't changed and we really need to show content
			Watcher.Recalc();
			if ( nOffsetBottom > Watcher.nOffsetTopTrigger )
			{
				Watcher.fnOnHit();
				cCompletedWatchers++;
			}
		}
		else
		{
			break;
		}
	}

	if ( cCompletedWatchers )
		CScrollOffsetWatcher.sm_rgWatchers.splice( 0, cCompletedWatchers );

	if ( CScrollOffsetWatcher.sm_rgWatchers.length == 0 )
	{
		$J(window).off( 'scroll.ScrollOffsetWatcher' );
		$J(window).off( 'resize.ScrollOffsetWatcher' );
	}
};

function LoadImageGroupOnScroll( elTarget, strGroup )
{
	var $Element = $J( '#' + elTarget );
	if ( $Element.length )
		new CScrollOffsetWatcher( $Element, function() { LoadDelayedImages(strGroup); } );
}

function LoadDelayedImages( group )
{
	if ( typeof g_rgDelayedLoadImages != 'undefined' && g_rgDelayedLoadImages[group] )
	{
		var rgURLs = g_rgDelayedLoadImages[group];
		for ( var i=0; i < rgURLs.length; i++ )
		{
			$J('#delayedimage_' + group + '_' + i).attr( 'src', rgURLs[i] );
		}

		g_rgDelayedLoadImages[group] = false;
	}
}

WebStorage = {
	GetLocal: function ( key, bSessionOnly )
	{
		var type = ( bSessionOnly ) ? 'session' : 'local';

		var storage = window[type + 'Storage'];

		if ( !window[type + 'Storage'] )
			return WebStorage.GetCookie( key );

		var value;
		try {
			value = storage.getItem(key);
		} catch(err) {
			// storage.getItem can throw SecurityError based on user's browser setting.
			value = null;
		}

		try {
			value = V_ParseJSON( value );
		} catch(err){
			return null;
		}

		if( value == null )
		{
			// Check if we have the value stored in a cookie instead. If so, move that to LS and remove the cookie
			value = V_GetCookie( key );
			if( value != null )
			{
				WebStorage.SetLocal( key, value, bSessionOnly );
				WebStorage.ClearCookie( key );
			}
		}
		return value;
	},
	GetLocalSession: function( key )
	{
		return WebStorage.GetLocal( key, true );
	},
	SetLocal: function ( key, value, bSessionOnly )
	{
		var type = ( bSessionOnly ) ? 'session' : 'local';

		var storage = window[type + 'Storage'];

		if ( !window[type + 'Storage'] )
			return WebStorage.SetCookie( key, value, ( bSessionOnly ) ? null : 365 );

		value = V_ToJSON( value );

		storage.setItem( key, value, type);
	},
	SetLocalSession: function( key, value )
	{
		WebStorage.SetLocal( key, value, true );
	},
	GetCookie: function( key )
	{
		var keyValue = V_GetCookie( key );
		if ( keyValue )
			keyValue = decodeURIComponent( keyValue );

		return V_IsJSON( keyValue ) ? V_ParseJSON( keyValue ) : keyValue;
	},
	SetCookie: function( key, value, duration )
	{
		value = encodeURIComponent( V_ToJSON( value ) );
		V_SetCookie( key, value, duration );
	},
	ClearCookie: function( key )
	{
		WebStorage.SetCookie(key, null, -1 );
	}
};

// takes an integer
function v_numberformat( n, decimals, strDecimalSymbol, strThousandsSeperator )
{
	if ( typeof strDecimalSymbol == 'undefined' && typeof strThousandsSeperator == 'undefined' && typeof Number != 'undefined' && typeof Number.toLocaleString != 'undefined' )
	{
		var options = {};
		if ( typeof decimals != 'undefined' && decimals !== 0 )
		{
			options.minimumFractionDigits = decimals;
			options.maximumFractionDigits = decimals;
		}

		var num = new Number(n);
		try
		{
			return num.toLocaleString( false, options );
		}
		catch( e )
		{
			return num.toString();
		}
	}

	var str = '' + ( n ? n : 0 );
	var len = str.indexOf( '.' );
	if ( len == -1 )
		len = str.length;
	var out = '';
	for ( var i = 0; i < len; i++ )
	{
		var c = str.charAt(i);
		out += c;
		if ( i < len - 1 && (len - i - 1) % 3 == 0 && c != '-' )
			out += ( typeof strThousandsSeperator == 'undefined' ? ',' : strThousandsSeperator );
	}
	if ( ( len < str.length || decimals ) && typeof decimals != 'undefined' && decimals !== 0 )
	{
		len++;
		out += ( typeof strDecimalSymbol == 'undefined' ? ',' : strDecimalSymbol );
		for ( var i = 0; i < ( decimals ? decimals : str.length - len ); i++ )
		{
			if ( len + i < str.length )
				out += str.charAt( len + i );
			else
				out += '0';
		}
	}

	return out;
}


function v_shuffle( rgArray )
{
	for ( var i = 0; i < rgArray.length; i++ )
	{
		var iSwap = Math.floor( Math.random() * ( rgArray.length - i ) + i );
		if ( iSwap != i )
		{
			var temp = rgArray[iSwap];
			rgArray[iSwap] = rgArray[i];
			rgArray[i] = temp;
		}
	}

	return rgArray;
}


function UpdateFormattedNumber( element, delta )
{
	var $Element = $J(element);
	$Element.text( v_numberformat( parseInt( $Element.text().replace( /,/, '' ) ) + delta ) );
}

function RateAnnouncement( rateURL, gid, bVoteUp )
{
	if ( bVoteUp && $J('#VoteUpBtn_' + gid).hasClass( "btn_active" ) )
	{
		return;
	}
	if ( !bVoteUp && $J('#VoteDownBtn_' + gid).hasClass( "btn_active" ) )
	{
		return;
	}

	rateURL = rateURL + gid;
	$J.post( rateURL, {
			'voteup' : bVoteUp,
			'sessionid' : g_sessionID
		}
	).done( function( json ) {

		var votesUpCount = $J('#VotesUpCount_' + gid);
		if ( votesUpCount )
		{
			var increment = 0;
			if ( bVoteUp )
			{
				increment = 1;
			}
			else if ( $J('#VoteUpBtn_' + gid).hasClass( 'btn_active' ) )
			{
				increment = -1;
			}
			UpdateFormattedNumber( votesUpCount, increment );

			if ( parseInt( votesUpCount.html().replace(/,/g, '') ) == 0 )
			{
				$J('#VotesUpCountContainer_' + gid).hide();
			}
			else
			{
				$J('#VotesUpCountContainer_' + gid).show();
			}
		}

		if ( bVoteUp )
		{
			$J('#VoteUpBtn_' + gid).addClass( "btn_active" );
			$J('#VoteDownBtn_' + gid).removeClass( "btn_active" );
		}
		else
		{
			$J('#VoteDownBtn_' + gid).addClass( "btn_active" );
			$J('#VoteUpBtn_' + gid).removeClass( "btn_active" );
		}



	} )
	.fail( function( jqxhr ) {
		var responseJSON = jqxhr.responseText.evalJSON();
		switch ( responseJSON.success )
		{
			case 21:
				ShowAlertDialog( 'Error', 'You must be logged in to perform that action.' );
				break;
			case 24:
				ShowAlertDialog( 'Error',
					'Your account does not meet the requirements to use this feature. <a class="whiteLink" href="https://help.steampowered.com/en/wizard/HelpWithLimitedAccount" target="_blank" rel="noreferrer">Visit Steam Support</a> for more information.'
				);
				break;
			case 15:
				ShowAlertDialog( 'Error', 'You do not have permission to perform that action.' );
				break;
			default:
				ShowAlertDialog( 'Error', 'There was an error encountered while processing your request: ' + responseJSON.success );
				break;
		}
	} );
	return false;
}

function GetResponsiveHeaderFixedOffsetAdjustment()
{
	// for responsive pages - we need to adjust for the menu
	var $ResponsiveHeader = $J('.responsive_header:visible');
	if ( $ResponsiveHeader.length && $ResponsiveHeader.css('position') == 'fixed' )
		return $ResponsiveHeader.outerHeight();
	else
		return 0;
}

/* Scroll to an element if it's not already in view.  If it's at the bottom of the viewport, then it will be
 scrolled to the top if less than nRequiredPixelsToShow are visible (defaults to the height of the element)
 */
function ScrollToIfNotInView( elem, nRequiredPixelsToShow, nSpacingBefore, nAnimationSpeed )
{
	var $Elem = $JFromIDOrElement(elem);

	if ( typeof nSpacingBefore == 'undefined' )
		nSpacingBefore = 0;

	// for responsive pages - we need to adjust for the menu
	nSpacingBefore += GetResponsiveHeaderFixedOffsetAdjustment();

	var elemTop = $Elem.offset().top;
	var nViewportOffsetTop = elemTop - $J(window).scrollTop();
	var bNeedToScroll = false;
	if ( nViewportOffsetTop < 0 )
	{
		bNeedToScroll = true;
	}
	else
	{
		if ( !nRequiredPixelsToShow )
			nRequiredPixelsToShow = $Elem.outerHeight();

		var nViewportOffsetBottom = nViewportOffsetTop + nRequiredPixelsToShow;

		if ( nViewportOffsetBottom > $J(window).height() )
			bNeedToScroll = true;
	}

	if ( bNeedToScroll )
	{
		if ( nSpacingBefore )
			nViewportOffsetTop -= nSpacingBefore;

		if ( typeof nAnimationSpeed != 'undefined' )
			$J('html, body' ).animate( {scrollTop: nViewportOffsetTop}, nAnimationSpeed );
		else
			window.scrollBy( 0, nViewportOffsetTop );
	}
}

function CAjaxInfiniteScrollingControls( rgSearchData, url )
{
	this.m_strActionURL = null;
	this.m_cPageSize = null;
	this.m_strElementPrefix = "";
	this.m_strClassPrefix = "";
	this.m_rgStaticParams = null;

	this.m_strQuery = null;
	this.m_cTotalCount = 0;
	this.m_iCurrentPage = 0;
	this.m_cMaxPages = 0;
	this.m_bLoading = false;

	this.m_fnPreRequestHandler = null;
	this.m_fnResponseHandler = null;
	this.m_fnPageChangingHandler = null;
	this.m_fnPageChangedHandler = null;

	this.m_LoadingDialog = null;
	this.m_bRestoringScrollTop = false;

	this.m_strActionURL = url;

	this.m_strQuery = rgSearchData['query'];
	this.m_cTotalCount = rgSearchData['total_count'];
	this.m_iCurrentPage = 0;
	this.m_cPageSize = rgSearchData['pagesize'];
	this.m_cMaxPages = Math.ceil( this.m_cTotalCount / this.m_cPageSize );

	if ( rgSearchData['prefix'] )
		this.m_strElementPrefix = rgSearchData['prefix'];

	if ( rgSearchData['class_prefix'] )
		this.m_strClassPrefix = rgSearchData['class_prefix'];

	var thisControl = this;
	var scrollFunc = function( event ) {
		this.OnScroll( event );
	};
	$J(document).scroll( function() { return scrollFunc.apply( thisControl ) } );

	window.addEventListener('beforeunload', function( event ) { thisControl.OnUnload( event ); } );

	this.RestoreScrollTop( true );
}

CAjaxInfiniteScrollingControls.prototype.DoneRestoreScrollTop = function()
{
	if ( this.m_LoadingDialog )
	{
		this.m_LoadingDialog.Dismiss();
		this.m_LoadingDialog = null;
	}
	this.m_bRestoringScrollTop = false;
};

CAjaxInfiniteScrollingControls.prototype.RestoreScrollTop = function( bForce )
{
	this.m_bRestoringScrollTop |= bForce;
	if ( !this.m_bRestoringScrollTop )
	{
		return;
	}
	var scrollTopPrevious = parseInt( $J( "#" + this.m_strElementPrefix + '_scroll_top').val() );
	if ( scrollTopPrevious != 0 )
	{
		var viewport = document.viewport.getDimensions(); // Gets the viewport as an object literal
		var windowHeight = viewport.height; // Usable window height
		var bodyHeight = $(document.body).getHeight();

		// done?
		if ( scrollTopPrevious < bodyHeight - windowHeight )
		{
			this.DoneRestoreScrollTop();
			window.scrollTo( 0, scrollTopPrevious );
		}
		else
		{
			if ( this.m_LoadingDialog == null )
			{
				this.m_LoadingDialog = ShowBlockingWaitDialog( 'Please Wait', 'Returning to where you were last on this page...' );
			}
			window.scrollTo( 0, scrollTopPrevious );
		}
	}
};

CAjaxInfiniteScrollingControls.prototype.OnUnload = function( event )
{
	var scrollOffset = document.viewport.getScrollOffsets();
	var scrollTop = scrollOffset.top;
	$J( "#" + this.m_strElementPrefix + '_scroll_top').val( scrollTop );
};

CAjaxInfiniteScrollingControls.prototype.OnScroll = function( event )
{
	if ( this.m_bLoading )
		return;

	var nCurrentScroll = $J(window).scrollTop() + $J(window).height();

	var rows = $J('#' + this.m_strElementPrefix + 'Rows');
	var offset = rows.offset();
	var nTriggerPoint = rows.height() + offset.top - 750;

	if ( nCurrentScroll >  nTriggerPoint )
	{
		this.NextPage();
	}
};

CAjaxInfiniteScrollingControls.prototype.GetActionURL = function( action )
{
	var url = this.m_strActionURL + action + '/';
	return url;
};

CAjaxInfiniteScrollingControls.prototype.SetPreRequestHandler = function( fnHandler )
{
	this.m_fnPreRequestHandler = fnHandler;
};

CAjaxInfiniteScrollingControls.prototype.SetResponseHandler = function( fnHandler )
{
	this.m_fnResponseHandler = fnHandler;
};

CAjaxInfiniteScrollingControls.prototype.SetPageChangingHandler = function ( fnHandler )
{
	this.m_fnPageChangingHandler = fnHandler;
};

CAjaxInfiniteScrollingControls.prototype.SetPageChangedHandler = function ( fnHandler )
{
	this.m_fnPageChangedHandler = fnHandler;
};

CAjaxInfiniteScrollingControls.prototype.SetStaticParameters = function ( rgParams )
{
	this.m_rgStaticParams = rgParams;
};

CAjaxInfiniteScrollingControls.prototype.OnAJAXComplete = function()
{
	this.m_bLoading = false;
};

CAjaxInfiniteScrollingControls.prototype.NextPage = function()
{
	if ( this.m_iCurrentPage < this.m_cMaxPages - 1 )
		this.LoadPage( this.m_iCurrentPage + 1 );
};

CAjaxInfiniteScrollingControls.prototype.LoadPage = function( iPage, bForce )
{
	if ( typeof( bForce )== 'undefined' || !bForce )
	{
		if ( this.m_bLoading || iPage >= this.m_cMaxPages || iPage < 0 )
		{
			return false;
		}
		else if ( iPage == this.m_iCurrentPage )
		{
			this.RestoreScrollTop( false );
		}
	}

	var params = {
		query: this.m_strQuery,
		start: this.m_cPageSize * iPage,
		count: this.m_cPageSize
	};

	if ( this.m_rgStaticParams != null )
	{
		for ( var sParamName in this.m_rgStaticParams )
		{
			if ( typeof sParamName != "string" )
				continue;

			if ( typeof this.m_rgStaticParams[sParamName] != "string" )
				continue;

			params[sParamName] = this.m_rgStaticParams[sParamName];
		}
	}

	if ( this.m_fnPageChangingHandler != null )
		this.m_fnPageChangingHandler( iPage );

	if ( this.m_fnPreRequestHandler != null )
		this.m_fnPreRequestHandler( params );

	var elLoading = $(this.m_strElementPrefix + '_loading');
	elLoading.show();

	this.m_bLoading = true;
	new Ajax.Request( this.GetActionURL( '' ), {
		method: 'get',
		parameters: params,
		onSuccess: this.OnResponseRenderResults.bind( this ),
		onComplete: this.OnAJAXComplete.bind( this )
	});

	return true;
};

CAjaxInfiniteScrollingControls.prototype.OnResponseRenderResults = function( transport )
{
	if ( transport.responseJSON && transport.responseJSON.success )
	{
		var elLoading = $(this.m_strElementPrefix + '_loading');
		elLoading.hide();

		if ( typeof RecordAJAXPageView !== "undefined" )
		{
			RecordAJAXPageView( transport.request.url );
		}

		var response = transport.responseJSON;
		this.m_cTotalCount = response.total_count;
		this.m_cMaxPages = Math.ceil( response.total_count / this.m_cPageSize );
		this.m_iCurrentPage = Math.floor( response.start / this.m_cPageSize );

		if ( this.m_iCurrentPage != 0 && this.m_cTotalCount <= response.start )
		{
			// this page is no longer valid, flip back a page (deferred so that the AJAX handler exits and reset m_bLoading)
			this.DoneRestoreScrollTop();
			return;
		}

		var elResults = $(this.m_strElementPrefix + 'Rows');

		elResults.insert( response.results_html );

		if ( this.m_fnResponseHandler != null )
		{
			this.m_fnResponseHandler( response );
		}

		if ( this.m_fnPageChangedHandler != null )
			this.m_fnPageChangedHandler( this.m_iCurrentPage );

		this.m_bLoading = false;
		if ( this.m_iCurrentPage < this.m_cMaxPages - 1 )
		{
			this.RestoreScrollTop( false );
		}
		else
		{
			this.DoneRestoreScrollTop();
		}
	}
	else
	{
		this.DoneRestoreScrollTop();
	}
};

function CAjaxPagingControls( rgSearchData, url )
{
	this.m_strActionURL = null;
	this.m_cPageSize = null;
	this.m_strElementPrefix = "";
	this.m_strClassPrefix = "";
	this.m_rgStaticParams = null;

	this.m_strQuery = null;
	this.m_cTotalCount = 0;
	this.m_iCurrentPage = 0;
	this.m_cMaxPages = 0;
	this.m_bLoading = false;

	this.m_fnPreRequestHandler = null;
	this.m_fnResponseHandler = null;
	this.m_fnPageChangingHandler = null;
	this.m_fnPageChangedHandler = null;


	this.m_strActionURL = url;

	this.m_strQuery = rgSearchData['query'];
	this.m_cTotalCount = rgSearchData['total_count'];
	this.m_iCurrentPage = 0;
	this.m_cPageSize = rgSearchData['pagesize'];
	this.m_cMaxPages = Math.ceil( this.m_cTotalCount / this.m_cPageSize );
	this.m_strDefaultAction = typeof rgSearchData['action'] != 'undefined' ? rgSearchData['action'] : 'render';


	if ( rgSearchData['prefix'] )
		this.m_strElementPrefix = rgSearchData['prefix'];

	if ( rgSearchData['class_prefix'] )
		this.m_strClassPrefix = rgSearchData['class_prefix'];

	$(this.m_strElementPrefix + '_btn_prev').observe( 'click', this.PrevPage.bind( this ) );
	$(this.m_strElementPrefix + '_btn_next').observe( 'click', this.NextPage.bind( this ) );

	this.UpdatePagingDisplay();
}

CAjaxPagingControls.prototype.GetActionURL = function( action )
{
	var url = action ? this.m_strActionURL + action + '/' : this.m_strActionURL;
	return url;
};

CAjaxPagingControls.prototype.SetPreRequestHandler = function( fnHandler )
{
	this.m_fnPreRequestHandler = fnHandler;
};

CAjaxPagingControls.prototype.SetResponseHandler = function( fnHandler )
{
	this.m_fnResponseHandler = fnHandler;
};

CAjaxPagingControls.prototype.SetPageChangingHandler = function ( fnHandler )
{
	this.m_fnPageChangingHandler = fnHandler;
};

CAjaxPagingControls.prototype.SetPageChangedHandler = function ( fnHandler )
{
	this.m_fnPageChangedHandler = fnHandler;
};

CAjaxPagingControls.prototype.SetStaticParameters = function ( rgParams )
{
	this.m_rgStaticParams = rgParams;
};

CAjaxPagingControls.prototype.OnAJAXComplete = function()
{
	this.m_bLoading = false;
};

CAjaxPagingControls.prototype.NextPage = function()
{
	if ( this.m_iCurrentPage < this.m_cMaxPages - 1 )
		this.GoToPage( this.m_iCurrentPage + 1 );
};

CAjaxPagingControls.prototype.PrevPage = function()
{
	if ( this.m_iCurrentPage > 0 )
		this.GoToPage( this.m_iCurrentPage - 1 );
};

CAjaxPagingControls.prototype.GoToPage = function( iPage, bForce )
{
	if ( typeof( bForce )== 'undefined' || !bForce )
	{
		if ( this.m_bLoading || iPage >= this.m_cMaxPages || iPage < 0 || iPage == this.m_iCurrentPage )
			return false;
	}

	var params = {
		query: this.m_strQuery,
		start: this.m_cPageSize * iPage,
		count: this.m_cPageSize
	};

	if ( this.m_rgStaticParams != null )
	{
		for ( var sParamName in this.m_rgStaticParams )
		{
			if ( typeof sParamName != "string" )
				continue;

			if ( typeof this.m_rgStaticParams[sParamName] != "string" )
				continue;

			params[sParamName] = this.m_rgStaticParams[sParamName];
		}
	}

	if ( this.m_fnPageChangingHandler != null )
		this.m_fnPageChangingHandler( iPage );

	if ( this.m_fnPreRequestHandler != null )
		this.m_fnPreRequestHandler( params );

	this.m_bLoading = true;
	new Ajax.Request( this.GetActionURL( this.m_strDefaultAction ), {
		method: 'get',
		parameters: params,
		onSuccess: this.OnResponseRenderResults.bind( this ),
		onComplete: this.OnAJAXComplete.bind( this )
	});

	return true;
};

CAjaxPagingControls.prototype.OnResponseRenderResults = function( transport )
{
	if ( transport.responseJSON && transport.responseJSON.success )
	{
		if ( typeof RecordAJAXPageView !== "undefined" )
		{
			RecordAJAXPageView( transport.request.url );
		}

		var response = transport.responseJSON;
		this.m_cTotalCount = response.total_count;
		this.m_cMaxPages = Math.ceil( response.total_count / this.m_cPageSize );
		this.m_iCurrentPage = Math.floor( response.start / this.m_cPageSize );

		if ( this.m_iCurrentPage != 0 && this.m_cTotalCount <= response.start )
		{
			// this page is no longer valid, flip back a page (deferred so that the AJAX handler exits and reset m_bLoading)
			this.GoToPage.bind( this, this.m_iCurrentPage - 1 ).defer();

			return;
		}



		var elResults = $(this.m_strElementPrefix + 'Rows');

		if( elResults)
			elResults.update( response.results_html );

		if ( this.m_fnResponseHandler != null )
			this.m_fnResponseHandler( response );

		this.UpdatePagingDisplay();

		ScrollToIfNotInView( $(this.m_strElementPrefix + 'Table'), 40 );
	}
};

CAjaxPagingControls.prototype.UpdatePagingDisplay = function()
{
	var elemNoResults = $(this.m_strElementPrefix + '_no_results');
	if ( this.m_cTotalCount == 0 )
	{
		$(this.m_strElementPrefix + '_ctn').hide();
		if ( elemNoResults )
			elemNoResults.show();
	}
	else
	{
		$(this.m_strElementPrefix + '_ctn').show();
		if ( elemNoResults )
			elemNoResults.hide();

		$(this.m_strElementPrefix + '_total').update( v_numberformat( this.m_cTotalCount ) );
		$(this.m_strElementPrefix + '_start').update( v_numberformat( this.m_iCurrentPage * this.m_cPageSize + 1 ) );
		$(this.m_strElementPrefix + '_end').update( Math.min( ( this.m_iCurrentPage + 1 ) * this.m_cPageSize, this.m_cTotalCount ) );
	}

	if ( this.m_cMaxPages <= 1 )
	{
		$(this.m_strElementPrefix + '_controls').hide();
	}
	else
	{
		$(this.m_strElementPrefix + '_controls').show();
		if ( this.m_iCurrentPage > 0 )
			$(this.m_strElementPrefix + '_btn_prev').removeClassName('disabled');
		else
			$(this.m_strElementPrefix + '_btn_prev').addClassName('disabled');

		if ( this.m_iCurrentPage < this.m_cMaxPages - 1 )
			$(this.m_strElementPrefix + '_btn_next').removeClassName('disabled');
		else
			$(this.m_strElementPrefix + '_btn_next').addClassName('disabled');

		var elPageLinks = $(this.m_strElementPrefix + '_links');
		elPageLinks.update('');
		// we always show first, last, + 3 page links closest to current page
		var cPageLinksAheadBehind = 2;
		var firstPageLink = Math.max( this.m_iCurrentPage - cPageLinksAheadBehind, 1 );
		var lastPageLink = Math.min( this.m_iCurrentPage + (cPageLinksAheadBehind*2) + ( firstPageLink - this.m_iCurrentPage ), this.m_cMaxPages - 2 );

		if ( lastPageLink - this.m_iCurrentPage < cPageLinksAheadBehind )
			firstPageLink = Math.max( this.m_iCurrentPage - (cPageLinksAheadBehind*2) + ( lastPageLink - this.m_iCurrentPage ), 1 );

		this.AddPageLink( elPageLinks, 0 );
		if ( firstPageLink != 1 )
			elPageLinks.insert( ' ... ' );

		for ( var iPage = firstPageLink; iPage <= lastPageLink; iPage++ )
		{
			this.AddPageLink( elPageLinks, iPage );
		}

		if ( lastPageLink != this.m_cMaxPages - 2 )
			elPageLinks.insert( ' ... ' );
		this.AddPageLink( elPageLinks, this.m_cMaxPages - 1 );
	}

	if ( this.m_fnPageChangedHandler != null )
		this.m_fnPageChangedHandler( this.m_iCurrentPage );
};

CAjaxPagingControls.prototype.AddPageLink = function( elPageLinks, iPage )
{
	var el = new Element( 'span', {'class': ( this.m_strClassPrefix != "" ? this.m_strClassPrefix : this.m_strElementPrefix ) + '_paging_pagelink' } );
	el.update( (iPage + 1) + ' ' );

	if ( iPage == this.m_iCurrentPage )
		el.addClassName( 'active' );
	else
		el.observe( 'click', this.GoToPage.bind( this, iPage ) );

	elPageLinks.insert( el );
};


function CSlider( $Container, $Grabber, args )
{
	this.m_$Container = $Container;
	this.m_$Grabber = $Grabber || $Container.find('.handle');
	this.m_nMinVal = args.min || 0;
	this.m_nMaxVal = args.max || 100;
	this.m_nIncrement = args.increment || 1;
	this.m_nValue = args.value || 0;
	this.m_fnOnChange = args.fnOnChange || function( value, bInDrag ) {};

	this.m_$Grabber.css( 'position', 'absolute' );
	this.CalcRatios();
	this.SetValue( this.m_nValue );

	var fnGetPageX = function( event )
	{
		if ( event.type.indexOf( 'touch' ) == 0 )
		{
			var TouchEvent = event.originalEvent;
			var rgTouches = TouchEvent ? TouchEvent.touches : null;
			if ( !rgTouches || rgTouches.length < 1 )
				return event.pageX || 0;	//probably wrong
			return rgTouches[0].pageX || 0;
		}
		else
		{
			return event.pageX || 0;
		}
	};

	var _this = this;
	this.m_$Container.on( 'mousedown touchstart', function( event ) {
		_this.CalcRatios();

		if ( !_this.m_$Grabber.is( event.target ) )
		{
			// jump the grabber to this position and start the drag
			var nPosition = fnGetPageX( event ) - _this.m_$Container.offset().left;
			// we want the grabber centered under the mosue if possible
			nPosition -= Math.floor( _this.m_$Grabber.width() / 2 );
			var nNewPosition = Math.min( Math.max( nPosition, 0 ), _this.m_nWidth );

			_this.m_$Grabber.css('left', nNewPosition + 'px' );
			_this.m_nValue = nNewPosition / _this.m_flRatio;
			if ( _this.m_nIncrement > 1 && _this.m_nValue < _this.m_nMaxVal ) {
				//_this.m_nValue += _this.m_nIncrement - 1;
				_this.m_nValue = parseInt(_this.m_nValue / _this.m_nIncrement) * _this.m_nIncrement;
			}

			_this.m_fnOnChange( _this.m_nValue, true );
		}
		var nInitialPosition = parseInt( _this.m_$Grabber.css('left') );
		var nStartDragX = fnGetPageX( event );

		$J(document).on( 'mousemove.CSlider touchmove.CSlider', function( event ) {
			var nDelta = fnGetPageX( event ) - nStartDragX;

			var nNewPosition = Math.min( Math.max( nInitialPosition + nDelta, 0 ), _this.m_nWidth );

			_this.m_$Grabber.css('left', nNewPosition + 'px' );
			_this.m_nValue = nNewPosition / _this.m_flRatio;
			if ( _this.m_nIncrement > 1  && _this.m_nValue < _this.m_nMaxVal ) {
				//_this.m_nValue += _this.m_nIncrement - 1;
				_this.m_nValue = parseInt(_this.m_nValue / _this.m_nIncrement) * _this.m_nIncrement;
			}

			_this.m_fnOnChange( _this.m_nValue, true );
		});
		$J(document).on( 'mouseup.CSlider touchend.CSlider', function( event ) {
			$J(document).off('.CSlider');
			_this.m_fnOnChange( _this.m_nValue, false );
		});

		event.preventDefault();
	});
}

CSlider.prototype.CalcRatios = function()
{
	var nGrabberWidth = this.m_$Grabber.width();
	this.m_nWidth = this.m_$Container.width() - nGrabberWidth;

	this.m_flRatio = this.m_nWidth / ( this.m_nMaxVal - this.m_nMinVal );
};

CSlider.prototype.SetValue = function( nValue, nAnimationSpeed )
{
	this.m_nValue = Math.min( Math.max( nValue, this.m_nMinVal ), this.m_nMaxVal );

	var nNewPosition = Math.floor( ( this.m_nValue - this.m_nMinVal ) * this.m_flRatio );

	this.m_$Grabber.stop();
	if ( nAnimationSpeed )
		this.m_$Grabber.animate( {left: nNewPosition }, nAnimationSpeed );
	else
		this.m_$Grabber.css( 'left',  nNewPosition + 'px' );
};

CSlider.prototype.GetValue = function()
{
	return this.m_nValue;
};

CSlider.prototype.GetMin = function()
{
	return this.m_nMinVal;
};

CSlider.prototype.GetMax = function()
{
	return this.m_nMaxVal;
};

CSlider.prototype.SetRange = function( nMinVal, nMaxVal, nValue )
{
	this.m_nMinVal = nMinVal;
	this.m_nMaxVal = nMaxVal;
	if ( typeof nValue != 'undefined' )
		this.m_nValue = nValue;
	this.CalcRatios();
	this.SetValue( this.m_nValue );
};

CSlider.prototype.SetIncrement = function( nIncrement )
{
	this.m_nIncrement = nIncrement;
};

function CScrollSlider( $Scroll, $Container, $Grabber, args )
{
	this.m_$Scroll = $Scroll;
	this.m_$SliderCtn = $Container;

	var $Slider = $Container.children('.slider');

	this.m_Slider = new CSlider( $Slider.length ? $Slider : $Container, $Grabber, { fnOnChange: $J.proxy( this.OnSliderChange, this )} );

	this.m_$Scroll.css('overflowX', 'scroll');
	// add momentum on iOS
	this.m_$Scroll.css('-webkit-overflow-scrolling', 'touch');

	var _this = this;
	var bDidInitialRecalc = false;
	this.m_$Scroll.on( 'scroll.ScrollSlider', function() {
		if ( !bDidInitialRecalc )
		{
			// we don't want to do this all the time, but on some browsers the first call to
			//	update ranges is too early and values don't compute correctly.
			_this.UpdateRanges();
			bDidInitialRecalc = true;
		}
		_this.m_Slider.SetValue( _this.m_$Scroll.scrollLeft() );
	});
	$J(window).on('resize.ScrollSlider', function() {
		_this.UpdateRanges();
	} );
	this.m_$Scroll.on( 'v_contentschanged', function() {
		_this.UpdateRanges();
	} );

	this.UpdateRanges();
}

CScrollSlider.prototype.SetValue = function( value, nAnimationSpeed ) {
	if ( nAnimationSpeed )
	{
		this.m_$Scroll.stop().animate( {'scrollLeft': value }, nAnimationSpeed );
	}
	else
	{
		this.m_$Scroll.stop().scrollLeft( value );
	}
};

CScrollSlider.prototype.GetValue = function() {
	return this.m_Slider.GetValue();
};

CScrollSlider.prototype.UpdateRanges = function()
{
	var nParentWidth = this.m_$Scroll.width();
	var nScrollWidth = this.m_$Scroll[0].scrollWidth;

	if ( nScrollWidth <= nParentWidth )
	{
		this.m_$SliderCtn.hide();
	}
	else
	{
		this.m_Slider.SetRange( 0, nScrollWidth - nParentWidth, this.m_$Scroll.scrollLeft() );
		this.m_$SliderCtn.show();
	}
};

CScrollSlider.prototype.OnSliderChange = function( value, bInDrag )
{
	this.m_$Scroll.stop().scrollLeft( value );
};

function IsValidEmailAddress( email )
{
	var email_regex = /^(("[\w-\s]+")|([\w-]+(?:\.[\w-]+)*)|("[\w-\s]+")([\w-]+(?:\.[\w-]+)*))(@((?:[\w-]+\.)*\w[\w-]{0,66})\.([a-z]{2,6}(?:\.[a-z]{2})?)$)|(@\[?((25[0-5]\.|2[0-4][0-9]\.|1[0-9]{2}\.|[0-9]{1,2}\.))((25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})\.){2}(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})\]?$)/i;
	return ( email != '' && email_regex.test(email) );
}


(function ($) {
  $.deparam = function (params, coerce) {
    var obj = {},
        coerce_types = { 'true': !0, 'false': !1, 'null': null };

    $.each(params.replace(/\+/g, ' ').split('&'), function (j,v) {
      var param = v.split('='),
          key = decodeURIComponent(param[0]),
          val,
          cur = obj,
          i = 0,

          keys = key.split(']['),
          keys_last = keys.length - 1;

      if (/\[/.test(keys[0]) && /\]$/.test(keys[keys_last])) {
        keys[keys_last] = keys[keys_last].replace(/\]$/, '');

        keys = keys.shift().split('[').concat(keys);

        keys_last = keys.length - 1;
      } else {
        keys_last = 0;
      }

      if (param.length === 2) {
        val = decodeURIComponent(param[1]);

        if (coerce) {
          val = val && !isNaN(val)              ? +val              // number
              : val === 'undefined'             ? undefined         // undefined
              : coerce_types[val] !== undefined ? coerce_types[val] // true, false, null
              : val;                                                // string
        }

        if ( keys_last ) {
          for (; i <= keys_last; i++) {
            key = keys[i] === '' ? cur.length : keys[i];
            cur = cur[key] = i < keys_last
              ? cur[key] || (keys[i+1] && isNaN(keys[i+1]) ? {} : [])
              : val;
          }

        } else {

          if ($.isArray(obj[key])) {
            obj[key].push( val );

          } else if (obj[key] !== undefined) {
            obj[key] = [obj[key], val];

          } else {
            obj[key] = val;
          }
        }

      } else if (key) {
        obj[key] = coerce
          ? undefined
          : '';
      }
    });

    return obj;
  };
})(jQuery);

/**
 * Generic search field that handles:
 * 1.) Showing default text if the input field is empty
 * 2.) When the input field gets focus, the text field clears
 * 3.) Adding CSS class to the input field when it is default text
 * 4.) When the user presses return/enter in  the field
 *
 * Call ClearIfDefaultValue() before submitting the form
 */
function SearchFieldWithText( elemID, defaultSearchText, onEnterFunc, defaultTextCSSClass )
{
	var elem = $( elemID );

	this.elem = elem;
	this.defaultSearchText = defaultSearchText;
	this.defaultTextCSSClass = defaultTextCSSClass;
	this.onEnterFunc = onEnterFunc;

	Event.observe( elem, 'click', this.handleClickOrFocus.bind(this));
	Event.observe( elem, 'focus', this.handleClickOrFocus.bind(this));
	Event.observe( elem, 'blur', this.handleBlur.bind(this));
	Event.observe( elem, 'keypress', this.handleKeypress.bind(this));
	Event.observe( elem.form, 'submit', this.ClearIfDefaultValue.bind(this));

	this.handleBlur();
}

SearchFieldWithText.prototype.handleClickOrFocus = function()
{
	if ( this.elem.value == this.defaultSearchText )
	{
		this.elem.value = '';
		if ( this.defaultTextCSSClass )
			this.elem.removeClassName( this.defaultTextCSSClass );
	}
};

SearchFieldWithText.prototype.handleBlur = function()
{
	if ( this.elem.value == '')
	{
		this.elem.value = this.defaultSearchText;
		if ( this.defaultTextCSSClass )
			this.elem.addClassName( this.defaultTextCSSClass );
	}
};

SearchFieldWithText.prototype.handleKeypress = function()
{
	if ( !this.onEnterFunc )
		return;

	var keyCode = null;
	if( event.which )
	{
		keyCode = event.which;
	}
	else if( event.keyCode )
	{
		keyCode = evt.keyCode;
	}
	if ( 13 == keyCode )
	{
		this.onEnterFunc();
	}
};

SearchFieldWithText.prototype.ClearIfDefaultValue = function()
{
	if ( this.elem.value == this.defaultSearchText )
	{
		this.elem.value = '';
	}
};


function CWebAPI( strWebAPIHost, strSecureWebAPIHost, strOAuth2Token )
{
	this.m_strHost = strWebAPIHost;
	this.m_strSecureWebAPIHost = strSecureWebAPIHost;
	this.m_strOAuth2Token = strOAuth2Token;
}

CWebAPI.prototype.BuildURL = function( strInterface, strMethod, bSecure, strVersion )
{
	if ( !strVersion )
		strVersion = 'v0001';

	var strURL = ( bSecure ? this.m_strSecureWebAPIHost : this.m_strHost );
	strURL += strInterface + '/' + strMethod + '/' + strVersion + '/';

	return strURL;
};

CWebAPI.prototype.ExecJSONP = function( strInterface, strMethod, rgParams, bSecure, strVersion, cTimeoutSecs )
{
	rgParams.access_token = this.m_strOAuth2Token;

	var rgJQueryParams = {
		url: this.BuildURL( strInterface, strMethod, bSecure, strVersion ),
		dataType: 'jsonp',
		jsonp: 'jsonp',				data: rgParams
	};

	if ( cTimeoutSecs )
		rgJQueryParams['timeout'] = cTimeoutSecs * 1000;

	return $J.ajax( rgJQueryParams );

	/*
	// using jsonp plugin instead of built-in jquery jsonp handling.  this library supposedly
	//	works around the firefox "waiting for host..." issue, but it doesn't work.
	return $J.jsonp({
		url: this.BuildURL( strInterface, strMethod, bSecure, strVersion ),
		callbackParameter: 'jsonp',				data: rgParams
	});
	*/
};

// Send a "beacon", which is specifically intended for use in OnUnload events (as outsdanding AJAX/JSONP requests may be cancelled)
// as of sept 2015, only chrome and firefox support this, no iOS or IE support.  Check for support before calling.
// Beacons are (per spec) always a POST request, and always include CORS headers.  WebAPI respondes properly to CORS for Valve domains.
CWebAPI.prototype.ExecBeacon = function( strInterface, strMethod, rgParams, bSecure, strVersion )
{
	rgParams.access_token = this.m_strOAuth2Token;

	var fdParams = new FormData();
	for ( var key in rgParams )
		fdParams.append( key, rgParams[key] );

	navigator.sendBeacon( this.BuildURL( strInterface, strMethod, bSecure, strVersion ), fdParams );
};


CWebAPI.prototype.ExecPOST = function( strInterface, strMethod, rgParams, bSecure, strVersion )
{
	rgParams.access_token = this.m_strOAuth2Token;
	rgParams.format = 'json';

	return $J.ajax( {
		url: this.BuildURL( strInterface, strMethod, bSecure, strVersion ),
		type: 'POST',
		data: rgParams
	});
};

// register some events to dismiss popup (ie, user clicking elsewhere on the window, escape)
//   cleans up event binds afterwards.  clicks to children of "elemIgnore" will not dismiss popup
function RegisterPopupDismissal( dismissFunc, elemIgnore )
{
	var $Ignore = $JFromIDOrElement( elemIgnore );
	// delay registration by one frame so that we don't catch the event that triggered this popup.
	window.setTimeout( function() {
		$J(document).on('click.RegisterPopupDismissal keydown.RegisterPopupDismissal', function (event) {

			if (event.keyCode && event.keyCode != 27 /* KEY_ESC */) {
				return;
			}
			var elem = $J(event.target);

			if ( $Ignore.length && $J.contains( $Ignore[0], elem[0] ) )
				return;

			dismissFunc();
			$J(document).off('.RegisterPopupDismissal');
		});
	}, 1 );
}





function ShowMenu( elemLink, elemPopup, align, valign, bLinkHasBorder )
{
	var $Link = $JFromIDOrElement(elemLink);
	var $Popup = $JFromIDOrElement(elemPopup);

	if ( $Link.hasClass('focus') )
	{
		HideMenu( elemLink, elemPopup );
		return;
	}

	AlignMenu( $Link, $Popup, align, valign, bLinkHasBorder );

	ShowWithFade( $Popup );
	$Link.addClass('focus');
	RegisterPopupDismissal( function() { HideMenu( elemLink, elemPopup ); }, $Popup );
}

function HideMenu( elemLink, elemPopup )
{
	var $Link = $JFromIDOrElement(elemLink);
	var $Popup = $JFromIDOrElement(elemPopup);

	$Link.data( 'menu-active', false );
	HideWithFade( $Popup );
	$Link.removeClass( 'focus' );
	$J(document).off('.RegisterPopupDismissal');
}

function HideMenuFast( elemLink, elemPopup )
{
	var $Link = $JFromIDOrElement(elemLink);
	var $Popup = $JFromIDOrElement(elemPopup);

	$Popup.hide();
	$Link.removeClass( 'focus' );
	$J(document).off('.RegisterPopupDismissal');
}


function RegisterFlyout( elemLink, elemPopup, align, valign, bLinkHasBorder )
{
	var $Link = $JFromIDOrElement( elemLink );
	var $Popup = $JFromIDOrElement( elemPopup );

	$Link.on( 'mouseenter', function( event ) {
		FlyoutMenu( $Link, $Popup, align, valign, bLinkHasBorder );
	});

	$Link.add( $Popup ).on( 'mouseleave', function( event ) {
		HideFlyoutMenu( event, $Link, $Popup );
	});
}

function FlyoutMenu( elemLink, elemPopup, align, valign, bLinkHasBorder )
{
	var $Link = $JFromIDOrElement(elemLink);
	var $Popup = $JFromIDOrElement(elemPopup);

	if ( !$Popup.is(':visible') || $Popup.css('opacity') < 1.0 )
	{
		AlignMenu( $Link, $Popup, align, valign, bLinkHasBorder );

		if ( $Popup.hasClass( 'responsive_slidedown') && window.UseSmallScreenMode && window.UseSmallScreenMode() )
			$Popup.stop().slideDown();
		else
			ShowWithFade( $Popup );

		$Link.addClass('focus');
	}

}

function HideFlyoutMenu( event, elemLink, elemPopup )
{
	var $Link = $JFromIDOrElement(elemLink);
	var $Popup = $JFromIDOrElement(elemPopup);

	if ( event )
	{
		var reltarget = $J( event.relatedTarget );
		if ( !reltarget.length ||
			( $Link.length && $J.contains( $Link[0], reltarget[0] ) ) ||
			( $Popup.length && $J.contains( $Popup[0], reltarget[0] ) ) ||
			$Link.is( reltarget ) )
			return;
	}
	// start hiding in a little bit, have to let the fade in animation start before we can cancel it

	if ( $Popup.hasClass( 'responsive_slidedown') && window.UseSmallScreenMode && window.UseSmallScreenMode() )
		$Popup.stop().slideUp();
	else
		window.setTimeout( function() { HideWithFade( $Popup ); }, 33 );

	$Link.removeClass('focus');
}

function AlignMenu( elemLink, elemPopup, align, valign, bLinkHasBorder )
{
	var align = align ? align : 'left';
	var $Link = $JFromIDOrElement(elemLink);
	var $Popup = $JFromIDOrElement(elemPopup);

	var offsetLink = $Link.offset();
	var nWindowScrollTop = $J(window).scrollTop();
	var nViewportHeight = $J(window).height();

	var nLinkViewportTop = offsetLink.top - nWindowScrollTop;

	// add a little bit of padding so we don't position it flush to an edge if possible
	var nPopupHeight = $Popup.height() + 8;

	if ( !valign )
	{
		//if there's not enough room between our spot and the top of the document, we definitely want to drop down
		if ( nWindowScrollTop + offsetLink.top < nPopupHeight )
		{
			valign = 'bottom';
		}
		else
		{
			var nSpaceAbove = nLinkViewportTop;
			var nSpaceBelow = nViewportHeight - ( nLinkViewportTop + $Link.height() );
			//otherwise we only want to drop down if we've got enough space below us (measured based on view area)
			// or if there's not enough space above to pop in either direction and there's more space below
			if ( nSpaceBelow > nPopupHeight || ( nSpaceAbove < nPopupHeight && nSpaceBelow > nSpaceAbove ) )
				valign = 'bottom';
			else
				valign = 'top';

		}
	}

	var borderpx = bLinkHasBorder ? 1 : 0;
	var shadowpx = $Popup.hasClass( 'popup_block_new' ) ? 0 : 12;
	var offsetLeft = 0;
	if ( align == 'left' )
	{
		//elemPopup.style.left = ( elemLink.positionedOffset()[0] - 12 ) + 'px';
		offsetLeft = -shadowpx - borderpx;
	}
	else if ( align == 'right' )
	{
		//elemPopup.style.left = ( elemLink.positionedOffset()[0] + elemLink.getWidth() - elemPopup.getWidth() + 13 ) + 'px';
		offsetLeft = $Link.outerWidth() - $Popup.outerWidth() + shadowpx + borderpx;
	}
	else if ( align == 'leftsubmenu' )
	{
		//elemPopup.style.left = ( elemLink.positionedOffset()[0] - elemPopup.getWidth() + 12 ) + 'px';
		offsetLeft = -$Popup.outerWidth() + shadowpx - borderpx;
	}
	else if ( align == 'rightsubmenu' )
	{
		//elemPopup.style.left = ( elemLink.positionedOffset()[0] + elemLink.getWidth() - 12 ) + 'px';
		offsetLeft = $Link.outerWidth()  - shadowpx + 2 * borderpx;
	}

	var offsetTop = 0;
	if ( valign == 'bottom' )
	{
		//elemPopup.style.top = ( elemLink.positionedOffset()[1] + elemLink.getHeight() - 12 ) + 'px';
		offsetTop = $Link.outerHeight() - shadowpx;
	}
	else if ( valign == 'top' )
	{
		//elemPopup.style.top = ( elemLink.positionedOffset()[1] - elemPopup.getHeight() + 12 ) + 'px';
		offsetTop = -$Popup.outerHeight() + shadowpx;
	}
	else if ( valign == 'bottomsubmenu' )
	{
		//elemPopup.style.top = ( elemLink.positionedOffset()[1] - 12 ) + 'px';
		offsetTop = -shadowpx;
	}


	var bPopupHidden = !$Popup.is(':visible');

	if ( bPopupHidden )
	{
		// IE can't do this with display: none elements
		$Popup.css( 'visibility', 'hidden' );
		$Popup.show();
	}

	$Popup.offset( {
		top: Math.max( offsetLink.top + offsetTop, 0 ),
		left: Math.max( offsetLink.left + offsetLeft, 0 )
	});

	if ( bPopupHidden )
	{
		// restore visibility
		$Popup.hide();
		$Popup.css( 'visibility', 'visible' );
	}
}

function BindAutoFlyoutEvents()
{
	$J(document).on( 'mouseenter.Flyout click.Flyout', '.flyout_tab', function(e) {
		var $Tab = $J(this);
		var $Content = $J('#' + $Tab.data('flyout') );
		var bResponsiveSlidedownMenu = window.UseSmallScreenMode && window.UseSmallScreenMode() && $Content.hasClass('responsive_slidedown');

		if ( !$Content.length || $Content.data('flyout-event-running') ||
			( e.type == 'mouseenter' && bResponsiveSlidedownMenu ) )
			return;

		$Content.data( 'flyout-event-running', true );
		window.setTimeout( function() { $Content.data('flyout-event-running', false ); }, 1 );

		if ( $Content.is(':visible') )
		{
			if ( e.type == 'click' )
				HideFlyoutMenu( null, $Tab, $Content );

			return;
		}

		if ( !$Content.data('flyout-mouseleave-bound') )
		{
			$Content.on('mouseleave.Flyout', function( e ) {
				if ( window.UseSmallScreenMode && window.UseSmallScreenMode() && $Content.hasClass('responsive_slidedown') )
					return;

				if ( $Tab.is( e.relatedTarget ) || $J.contains( $Tab[0], e.relatedTarget ) )
					return;

				HideFlyoutMenu( null, $Tab, $Content );
			});
			$Content.data('flyout-mouseleave-bound', true );
		}


		FlyoutMenu( $Tab, $Content, $Tab.data('flyout-align'), $Tab.data('flyout-valign') );

		if ( window.UseTouchFriendlyMode && window.UseTouchFriendlyMode() )
		{
			window.setTimeout( function() {
				$J(document).on('click.FlyoutDismiss', function(e) {
					if ( $J.contains( $Content[0], e.target ) || $Content.is( e.target ) )
						return;

					HideFlyoutMenu( null, $Tab, $Content );
					$J(document).off('click.FlyoutDismiss');
					e.preventDefault();
				});
			}, 1 );
		}
	});

	$J(document).on('mouseleave.Flyout', '.flyout_tab', function(e) {
		var $Tab = $J(this);
		var $Content = $J('#' + $Tab.data('flyout') );
		var bResponsiveSlidedownMenu = window.UseSmallScreenMode && window.UseSmallScreenMode() && $Content.hasClass('responsive_slidedown');

		if ( !$Content.length || $Content.data('flyout-event-running') || bResponsiveSlidedownMenu ||
			$Content.is( e.relatedTarget ) || $J.contains( $Content[0], e.relatedTarget ) )
			return;

		if ( $Content.is(':visible') )
		{
			HideFlyoutMenu( null, $Tab, $Content );

			return;
		}
	});
}

function PollOnUserActionAfterInterval( strNamespace, nPollInterval, fnCallback, nPollImmediateInterval )
{
	var bCallbackInvoked = false;
	var tsLastUserAction = $J.now();
	var fnInvokeCallbackOnNextUserAction;

	var strEvents = ['touchstart','mousemove','focus','scroll',''].join( '.' + strNamespace + ' ' );

	var fnDoPoll = function() {
		if ( !bCallbackInvoked )
			fnCallback();
		bCallbackInvoked = true;
		fnInvokeCallbackOnNextUserAction();
	};

	fnInvokeCallbackOnNextUserAction = function() {
		window.setTimeout( function() {
			bCallbackInvoked = false;
			if ( nPollImmediateInterval && $J.now() <= tsLastUserAction + nPollImmediateInterval )
			{
				fnDoPoll();
			}
			else
			{
				$J(window).on( strEvents, function() {
					$J(window ).off( '.' + strNamespace );
					tsLastUserAction = $J.now();
					fnDoPoll();
				});
			}
		}, nPollInterval );
	};

	fnInvokeCallbackOnNextUserAction();
}

var DELAY_BETWEEN_NOTIFICATION_COUNT_POLLS_MS = 30 * 1000;
function EnableNotificationCountPolling()
{
	var $NotificationItems = $J('.notification_ctn');
	var $NotificationTotalCounts = $J('.notification_count_total_ctn');
	if ( $NotificationItems.length || $NotificationTotalCounts.length )
	{
		PollOnUserActionAfterInterval( 'NotificationCountPoll', DELAY_BETWEEN_NOTIFICATION_COUNT_POLLS_MS, UpdateNotificationCounts );
	}
}

function UpdateNotificationCounts()
{
	var $NotificationItems = $J('.notification_ctn');
	var $NotificationTotalCounts = $J('.notification_count_total_ctn');
	if ( $NotificationItems.length || $NotificationTotalCounts.length )
	{
		$J.ajax( GetDefaultCommunityAJAXParams( 'actions/GetNotificationCounts', 'GET' ) ).done( function( data ) {
			var notifications = data && data.notifications;
			if ( notifications )
			{
				$NotificationItems.each( function() {
					var $NotificationItem = $J(this);
					var nNotificationType = $NotificationItem.data('notification-type');
					var cNotifications = notifications[nNotificationType] || 0;
					$NotificationItem.find('.notification_count' ).text( v_numberformat( cNotifications ) );

					if ( cNotifications > 0 )
						$NotificationItem.addClass('active_inbox_item');
					else
						$NotificationItem.removeClass('active_inbox_item');

					var $CountStrings = $NotificationItem.find( '.notification_count_string' );
					if ( $CountStrings.length )
					{
						if ( cNotifications == 1 )
						{
							$CountStrings.filter('.plural' ).hide();
							$CountStrings.filter('.singular' ).show();
						}
						else
						{
							$CountStrings.filter('.singular' ).hide();
							$CountStrings.filter('.plural' ).show();
						}
					}

				});

				if ( !notifications[ 11 ] )
				{
					$J('.global_header_account_alert').hide();
				}

				var cTotalNotifications = 0;
				for ( var type in notifications )
					cTotalNotifications += ( notifications[type] || 0 );
				$NotificationTotalCounts.find('.notification_count' ).text( v_numberformat( cTotalNotifications ) );

				if ( cTotalNotifications > 0 )
				{
					$NotificationTotalCounts.removeClass('no_notifications' ).addClass('has_notifications');
				}
				else
				{
					$NotificationTotalCounts.removeClass('has_notifications' ).addClass('no_notifications');
				}
			}
		});
	}
}


function PostToURLWithSession( url, rgParams )
{
	var $Form = $J('<form/>', {'action': url, 'method': 'POST' } );

	// site must set this js var or pass to this function
	if ( typeof g_sessionID != 'undefined' )
		$Form.append( $J('<input/>', {'type': 'hidden', 'name': 'sessionid', 'value': g_sessionID } ) );

	if ( rgParams )
	{
		for ( var name in rgParams )
			$Form.append( $J('<input/>', {'type': 'hidden', 'name': name, 'value': rgParams[name] } ) );
	}
	$Form.appendTo( 'body' );
	$Form.submit();
}


function ShowWithFade( elem, speed )
{
	var $Elem = $JFromIDOrElement(elem);

	$Elem.stop();
	$Elem.fadeTo( speed || 200, 1.0 );	//fadeTo rather than fadeIn in case it was already in a fade
}

function HideWithFade( elem, speed )
{
	var $Elem = $JFromIDOrElement(elem);

	$Elem.stop();
	$Elem.fadeOut( speed || 200 );
}


function LaunchWebChat( params )
{
	var winChat = window.open( '', 'SteamWebChat', 'height=790,width=1015,resize=yes,scrollbars=yes' );
	if ( !winChat )
	{
		// popup blocked - this sometimes happens when chat is initiated from the store.  just roll with it.
		return;
	}

	if ( winChat.location ==  'about:blank' )
	{
		// created a new window, set the url
		if ( params )
			SetValueLocalStorage( 'rgChatStartupParam', V_ToJSON( params ) );

		winChat.location = 'https://steamcommunity.com//chat/';
	}
	else
	{
		if ( params )
			winChat.OnWebchatLaunchURL( params );
	}
	winChat.focus();
}

function ShowSupportAlerts(url)
{
	window.open( url, 'SupportAlerts', 'height=700,width=700,resize=yes,scrollbars=yes' );
}

function ToggleFamilyView( bLocked, strURL )
{
	if ( bLocked )
	{
		window.location = strURL;
	}
	else
	{
		ShowConfirmDialog( 'Return to Family View',
			'Are you sure you want to return to Family View?',
			'Return to Family View'
		).done( function() {
			ShowBlockingWaitDialog( 'Return to Family View' );
			window.location = strURL;
		});
	}
}

function setTimezoneCookies()
{
	var now = new Date();
	var expire = new Date();

	// One year expiration, this way we don't need to wait at least one page
	// load to have accurate timezone info each session, but only each time the user
	// comes with cleared cookies
	expire.setTime( now.getTime() + 3600000*24*365 );
	var tzOffset = now.getTimezoneOffset() * -1 * 60;
	var isDST = 0;
	document.cookie = "timezoneOffset=" + tzOffset + "," + isDST + ";expires="+expire.toGMTString() + ";path=/";
}

function FlushStyleChanges( element )
{
	$J( element ).css( 'opacity');
}

var k_EScrollbarDirectionVertical = 1;
var k_EScrollbarDirectionHorizontal = 2;

window.VScrollbar = function( eleTarget, eleHandle, direction )
{
	this.m_eleHandle = eleHandle;
	this.m_eleTarget = eleTarget;

	var instance = this;

	var propOffset, propSize, propOuterSize, propDimension, propPage, directionInvert, propOffsetEvent;

	if( direction == k_EScrollbarDirectionVertical)
	{
		propOffset = 'top';
		propSize = 'height';
		propOuterSize = 'outerHeight';
		propDimension = 'y';
		propPage = 'pageY';
		propOffsetEvent = 'offsetY';
	} else if( direction == k_EScrollbarDirectionHorizontal )
	{
		propOffset = 'left';
		propSize = 'width';
		propOuterSize = 'outerWidth';
		propDimension = 'x';
		propPage = 'pageX';
		propOffsetEvent = 'offsetX';

		this.m_eleTarget.first().css({'white-space': 'nowrap'});
	}

	// Set up some CSS properties we need
	this.m_eleHandle.css({position: 'absolute'});
	if( this.m_eleHandle.parent().css('position') == 'static' )
		this.m_eleHandle.parent().css({position: 'relative'}); // Needs to be relative or absolute, only set it if we didn't do it in CSS
	this.m_eleTarget.css({position: 'relative', float: 'left'});
	this.m_eleTarget.css(propOffset, '0px');
	this.m_eleTarget.addClass('animating');
	this.m_eleTarget.parent().addClass('v_scrollbar_target');
	this.m_eleTarget.parent().css({position: 'relative', overflow: 'hidden'});
	this.m_nDesiredPosition = 0;
	this.m_flPercent = 0;


	var funcUpdate = function( bDisableTransitions )
	{
		var bScrolled = true;
		if( instance.m_eleTarget[propSize]() - instance.m_eleTarget.parent()[propSize]() <= 0 )
		{
			instance.m_eleHandle.parent().addClass('disabled');
			instance.m_flPercent = 0;
			bScrolled = false;
		} else
			instance.m_eleHandle.parent().removeClass('disabled');

		if( instance.m_flPercent < 0 )
			instance.m_flPercent = 0;

		if( instance.m_flPercent > 1 )
			instance.m_flPercent = 1;


		var percent = instance.m_flPercent;

		if( bDisableTransitions )
			instance.DisableTransitions();

		instance.m_nDesiredPosition = -percent * ( instance.m_eleTarget[propSize]() - instance.m_eleTarget.parent()[propSize]());

		// Update container
		instance.m_eleTarget[0].style[propOffset] = instance.m_nDesiredPosition + 'px';

		// Update scroll handle
		var handleMax = instance.m_eleHandle.parent()[propSize]() - instance.m_eleHandle[propOuterSize]();
		instance.m_eleHandle[0].style[propOffset] = ( percent * handleMax ) + 'px';

		if( bDisableTransitions )
			instance.EnableTransitions();

		return bScrolled;
	};

	var funcMouseMove = function( event ) {
		var localDimension = event[propPage] - instance.m_eleHandle.parent().offset()[propOffset];
		var localMax = instance.m_eleHandle.parent()[propSize]() - instance.m_eleHandle[propOuterSize]();

		var percent = localDimension / localMax;
		instance.m_flPercent = percent;

		if( funcUpdate(true) )
			event.preventDefault();


	};

	$J(eleTarget).bind('mousewheel DOMMouseScroll',function( event ){
		var delta = event.originalEvent.wheelDelta || event.originalEvent.detail * -12;

		var localY = instance.m_nDesiredPosition * -1;
		var localMax = instance.m_eleTarget[propOuterSize]() - instance.m_eleTarget.parent()[propSize]();

		if( localY <= 0 && delta > 0 || localY == localMax && delta < 0 )
			return;

		localY -= delta;

		if( localY < 0 ) localY = 0;
		if( localY > localMax  ) localY = localMax;

		var percent = localY / localMax;

		instance.m_flPercent = percent;

		if( funcUpdate() )
			event.preventDefault();
	});

	$J(eleHandle.parent()).bind('click',function( event ){
		var localY = instance.m_eleTarget.position()[propOffset] * -1;
		var localMax = instance.m_eleTarget[propOuterSize]() - instance.m_eleTarget.parent()[propSize]();

		var step = instance.m_eleTarget.parent()[propSize]();

		if( event[propOffsetEvent] < instance.m_eleHandle.position()[propOffset] )
			step *= -1;

		localY += step;

		if( localY < 0 ) localY = 0;
		if( localY > localMax  ) localY = localMax;

		var percent = localY / localMax;

		instance.m_flPercent = percent;

		if( funcUpdate() )
			event.preventDefault();
	});

	eleHandle.mousedown(function( event ){
		$J(window).bind('mousemove.scroll', funcMouseMove);
		event.stopPropagation();
	});

	eleHandle.click(function( event ){
		event.stopPropagation();
	});

	$J(window).mouseup(function( event ){
		$J(window).unbind('mousemove.scroll');
		event.stopPropagation();
	});

	// Resets scroll position to 0 and updates the window. Useful when adding/removing elements or resizing the scroll area
	this.Reset = function() {
		instance.m_flPercent = 0;

		return funcUpdate(true);
	};

	// Ensures target element is visible. This is taken from position() (NOT OFFSET) so the element must be a direct child of the scroll area
	this.EnsureVisible = function( ele ) {
		var $ele = $J(ele);
		var eleSize = $ele[propOuterSize](true);
		var minEdge = $ele.position()[propOffset] - (eleSize * 0.5);
		var maxEdge = minEdge + (eleSize * 2);


		var viewportMax = instance.m_eleTarget[propOuterSize]() - instance.m_eleTarget.parent()[propSize]();
		var viewportSize = instance.m_eleTarget.parent()[propSize]();
		var viewportPosition = instance.m_eleTarget.position()[propOffset] * -1;

		if( viewportPosition > minEdge )
			instance.m_flPercent = minEdge / viewportMax;
		else if( ( viewportPosition + viewportSize ) < maxEdge )
			instance.m_flPercent = ( maxEdge - viewportSize ) / viewportMax;

		return funcUpdate();
	};

	this.EnableTransitions = function() {
		instance.m_eleTarget.addClass('animating');
	};

	this.DisableTransitions = function() {
		instance.m_eleTarget.removeClass('animating');
	};

	funcUpdate(true);


};

function InitAutoComplete( elInput, fnSearch, fnOnChange )
{
	return new CAutoComplete( elInput, fnSearch, fnOnChange );
}

function CAutoComplete( elInput, fnSearch, fnOnChange )
{
	this.m_bSuppresseNextKeyUp = false;
	this.m_hSearchTimeout = 0;
	this.m_strLastSearch = '';

	this.m_$Input = $J( elInput );
	this.m_fnSearch = fnSearch;
	this.m_fnOnChange = fnOnChange;

		var strName = this.m_$Input.attr( 'name' );
	if ( !strName )
		strName = 'unknown';

	strName = strName + '_autocomplete';

	this.m_$Popup = $J ( '<div class="' + strName + '"></div>' );
	this.m_$Popup.css( 'width', this.m_$Input.outerWidth() + 'px' );
	this.m_$Input.after( this.m_$Popup );
	this.m_$Popup.hide();

	var _this = this;
	this.m_$Input.on( 'keydown.autocomplete', function( event ) { _this.OnInputKeyDown( event ); } );
	this.m_$Input.on( 'keyup.autocomplete', function( event ) { _this.OnInputKeyUp( event ); } );
	this.m_$Input.on( 'blur.autocomplete', function( event ) { _this.OnInputBlur( event ); } );
	this.m_$Input.on( 'change input paste', function( event ) { _this.OnInputChange( event ); } );

	this.m_$Popup.on( 'mousedown.autocomplete', function( event ) { _this.m_$Popup.data( 'mousedown', true ); } );
	this.m_$Popup.on( 'mouseup.autocomplete', function( event ) { _this.m_$Popup.data( 'mousedown', false ); } );
}

CAutoComplete.KEY_ENTER = 13;
CAutoComplete.KEY_UP = 38;
CAutoComplete.KEY_DOWN = 40;

CAutoComplete.prototype.OnInputChange = function( event )
{
		if ( this.m_fnOnChange )
		this.m_fnOnChange( this.m_$Input, null );

	if ( this.m_hSearchTimeout == 0 )
	{
		var _this = this;
		var fnDoSearch = function()
		{
			_this.m_hSearchTimeout = 0;
			var strSearch = _this.m_$Input.val();
			if ( strSearch == _this.m_strLastSearch )
				return;

			_this.m_strLastSearch = strSearch;
			_this.m_fnSearch( _this.m_$Input, strSearch, function( $Contents ) { _this.SetPopupContents( $Contents ); } );
		};

		this.m_hSearchTimeout = window.setTimeout( fnDoSearch, 300 );
	}
}

CAutoComplete.prototype.SetPopupContents = function( $Contents )
{
	if ( !$Contents )
	{
		this.ClosePopup();
		return;
	}

	this.m_$Popup.html( '' );
	this.m_$Popup.append( $Contents );

	var _this = this;
	this.m_$Popup.children().on( 'click.autocomplete', function( event ) { _this.SelectSuggestion( $J( this ) ); } );
	this.m_$Popup.show();
}

CAutoComplete.prototype.OnInputBlur = function( event )
{
	if ( !this.m_$Popup.data( 'mousedown' ) )
		this.ClosePopup();
}

CAutoComplete.prototype.SelectSuggestion = function( $Suggestion )
{
	if ( $Suggestion.length == 0 )
		return;

	this.m_$Input.val( $Suggestion.data( 'suggestion' ) );
	if ( this.m_fnOnChange )
		this.m_fnOnChange( this.m_$Input, $Suggestion );

	this.ClosePopup();
	this.m_$Input.focus();
}

CAutoComplete.prototype.ClosePopup = function()
{
	if ( this.m_hSearchTimeout != 0 )
	{
		window.clearTimeout( this.m_hSearchTimeout );
		this.m_hSearchTimeout = 0;
	}

	this.m_strLastSearch = '';
	this.m_$Popup.hide();
}

CAutoComplete.prototype.OnInputKeyDown = function( event )
{
	var $CurSuggestion = this.m_$Popup.children('.focus');
	var $NewSuggestion = $J();

	if ( event.keyCode == CAutoComplete.KEY_ENTER )
	{
		this.SelectSuggestion( $CurSuggestion );
		this.m_bSuppressNextKeyUp = true;
		event.preventDefault();
		return;
	}

	if ( event.keyCode == CAutoComplete.KEY_UP || event.keyCode == CAutoComplete.KEY_DOWN )
	{
		if ( event.keyCode == CAutoComplete.KEY_UP )
		{
			if ( $CurSuggestion.length )
				$NewSuggestion = $CurSuggestion.prev();
			if ( !$NewSuggestion.length )
				$NewSuggestion = this.m_$Popup.children( 'div:last-child' );
		}
		else
		{
			if ( $CurSuggestion.length )
				$NewSuggestion = $CurSuggestion.next();
			if ( !$NewSuggestion.length )
				$NewSuggestion = this.m_$Popup.children( 'div:first-child' );
		}

		if ( $NewSuggestion.length  )
		{
			$CurSuggestion.removeClass( 'focus' );
			$NewSuggestion.addClass( 'focus' );
		}

				event.preventDefault();
	}
}

CAutoComplete.prototype.OnInputKeyUp = function( event )
{
	if ( this.m_bSuppressNextKeyUp && event.keyCode == CAutoComplete.KEY_ENTER )
	{
		this.m_bSuppressNextKeyUp = false;
		event.preventDefault();
	}
}



function GetCurrentScrollPercentage()
{
	var s = $J(window).scrollTop();
	var d = $J(document).height();
	var c = $J(window).height();
	var scrollPercent = (s / (d-c)) * 100;
	return scrollPercent;
}

// @elemID id of the element
// @fixedOffsetTop offset from the top when fixed
// @bScrollWithPageIfTooTall if the element is taller than the page, then it will "scroll" with the page if this is true
// @docHeightOffset if bScrollWithPageIfTooTall is set to true, then this is how much the document height is reduced by (recommend this to be 130 for the typical footer)
function FixedElementOnScrollWrapper ( elemID, fixedOffsetTop, bScrollWithPageIfTooTall, docHeightOffset, params )
{
	params = $J.extend( {
		fixedClass: null
	}, params );

	this.fixedElement = $( elemID );
	this.$FixedElement = $JFromIDOrElement( elemID );
	this.fixedOffsetTop = typeof fixedOffsetTop != "undefined" ? fixedOffsetTop : 0;
	this.bScrollWithPageIfTooTall = typeof bScrollWithPageIfTooTall != "undefined" ? bScrollWithPageIfTooTall : false;
	this.docHeightOffset = typeof docHeightOffset != "undefined" ? docHeightOffset : 0;
	this.homePosn = { x: this.fixedElement.cumulativeOffset()[0], y: this.fixedElement.cumulativeOffset()[1] };
	this.fixedClass = params.fixedClass;


	this.$FixedElementPadding = $J('<div/>', {'class': 'FixedElementOnScrollWrapper_padding', 'id': 'ScrollWrapperPadding_' + elemID } ).hide();
	this.fixedElement.insert( { before: this.$FixedElementPadding[0] } );

	var _this = this;
	$J(window).on( 'scroll.FixedElementOnScrollWrapper hashchange.FixedElementOnScrollWrapper', function() { _this.handleScroll() } );
	$J(window).on( 'resize.FixedElementOnScrollWrapper', function() { _this.handleScroll( true /* force recalc */ ) } );
	this.handleScroll();
}

FixedElementOnScrollWrapper.prototype.BIsFixed = function()
{
	if ( this.fixedClass )
		return this.$FixedElement.hasClass( this.fixedClass );
	else
		return this.$FixedElement.css( 'position' ) == 'fixed';
}

FixedElementOnScrollWrapper.prototype.handleScroll = function( bForceRecalc )
{
	this.scrollOffset = document.viewport.getScrollOffsets().top;
	var offsetTop = this.fixedOffsetTop + GetResponsiveHeaderFixedOffsetAdjustment();

	if ( bForceRecalc && !this.BIsFixed() )
		this.homePosn = { x: this.fixedElement.cumulativeOffset()[0], y: this.fixedElement.cumulativeOffset()[1] };

	if ( this.scrollOffset > ( this.homePosn.y - offsetTop ) )
	{
		if ( !this.BIsFixed() || bForceRecalc )
		{
			if ( this.fixedClass )
				this.$FixedElement.addClass( this.fixedClass );
			else
				this.$FixedElement.css( 'position', 'fixed' );

			this.fixedElement.style.top = offsetTop + 'px';
			this.fixedElement.style.left = this.homePosn.x;

			// jquery show() sets display to block, which prevents css from hiding this element if needed.
			this.$FixedElementPadding.css( 'display', '' );
			this.$FixedElementPadding.css( 'height', this.fixedElement.getHeight() + 'px' );
		}

		if ( this.bScrollWithPageIfTooTall )
		{
			// this forces the element to scroll off the page, but there's enough that isn't on the page, "scroll" this guy percentage-wise
			var elemHeight = this.fixedElement.getHeight() + offsetTop;
			if ( elemHeight > document.viewport.getHeight() )
			{
				var currentScrollPercentage = GetCurrentScrollPercentage();
				var heightDiff = elemHeight - ( document.viewport.getHeight() - this.docHeightOffset );
				offsetTop -= Math.floor( heightDiff * currentScrollPercentage / 100 );
				this.fixedElement.style.top = offsetTop + 'px';
			}
		}
	}
	else
	{
		if ( this.BIsFixed() )
		{
			if ( this.fixedClass )
				this.$FixedElement.removeClass( this.fixedClass );
			else
				this.$FixedElement.css( 'position', '' );

			this.$FixedElement.css( 'top', '' ).css( 'left', '' );
			this.$FixedElementPadding.css( 'display', 'none' );
		}
	}
}

// general text suggestion control

// fnSuggestForTerm will be called with two values, the current string to get suggestions for,
//	and the callback to invoke with the new values.  You should always invoke the callback per call
//	to fnSuggestForTerm, but can delay due to ajax if needed.
function CTextInputSuggest( $InputElement, fnSuggestForTerm, fnOnSuggest, strCssClass )
{
	this.Init( $InputElement, fnSuggestForTerm, fnOnSuggest, strCssClass );
}

CTextInputSuggest.prototype.Init = function( $InputElement, fnSuggestForTerm, fnOnSuggest, strCssClass )
{
	if( !strCssClass )
		strCssClass = 'popup_block_new';
	this.m_bHaveSuggestions = false;
	this.m_$Input = $InputElement;
	this.m_fnSuggestForTerm = fnSuggestForTerm;
	this.m_fnOnSuggest = fnOnSuggest || function( term ) {};
	this.m_strLastVal = '';
	this.m_align = 'left';
	this.m_valign = 'bottom';

	this.m_$Focus = $J();
	this.m_strLastFocusVal = null;


	this.m_$SuggestionsCtn = $J('<div/>', {'class': strCssClass, style: 'display: none;' } );
	this.m_$Suggestions = $J('<div/>', {'class': 'popup_body popup_menu' } );
	this.m_$SuggestionsCtn.append( this.m_$Suggestions );

	this.m_$SuggestionsCtn.hide();
	$J(document.body).append( this.m_$SuggestionsCtn );

	var zIndex = 200;	//normal popup zindex
	this.m_$Input.parents().each( function() {
		var zIndexParent = $J(this).css('zIndex');
		if ( zIndexParent != 'auto' && zIndexParent != 0 )
		{
			zIndex = zIndexParent;
		}
	});
	this.m_$SuggestionsCtn.css( 'zIndex', zIndex + 20 );

	var _this = this;
	this.m_$Input.on( 'keyup.CTextInputSuggest click.CTextInputSuggest', function( event ) { _this.OnTextChanged( event ) } );
	this.m_$Input.on( 'paste.CTextInputSuggest cut.CTextInputSuggest', function() { window.setTimeout( function() { _this.OnTextChanged() }, 1 ); } );
	this.m_$Input.on( 'keydown.CTextInputSuggest', function( event ) { _this.OnKeyDown( event ) } );
	this.m_$Input.on( 'focus.CTextInputSuggest', function() { _this.ShowSuggestions() } );
	this.m_$Input.on( 'blur.CTextInputSuggest', function() { _this.HideSuggestions() } );
}

CTextInputSuggest.prototype.SetAlignment = function( align, valign )
{
	this.m_align = align || 'left';
	this.m_valign = valign || 'bottom';
};

CTextInputSuggest.prototype.SetSuggestionsContainerId = function( strSuggestionsCtnId )
{
	this.m_$SuggestionsCtn.attr( 'id', strSuggestionsCtnId );
};

CTextInputSuggest.prototype.ShowSuggestions = function()
{
	if ( !this.m_$SuggestionsCtn.find(':visible').length && this.m_bHaveSuggestions )
	{
		AlignMenu( this.m_$Input[0], this.m_$SuggestionsCtn[0], this.m_align, this.m_valign, true );
		this.m_$SuggestionsCtn.fadeIn( 'fast' );
	}
};

CTextInputSuggest.prototype.HideSuggestions = function()
{
	if ( this.m_bHaveSuggestions )
		this.m_$SuggestionsCtn.fadeOut( 'fast' );
	else
		this.m_$SuggestionsCtn.hide();
};

CTextInputSuggest.prototype.OnSuggestionSelected = function( $Suggestion )
{
	this.m_$Input.val( $Suggestion.text() );

	this.m_bHaveSuggestions = false;
	this.m_$Focus = $J();
	this.HideSuggestions();

	this.m_fnOnSuggest( $Suggestion.text() );
};

CTextInputSuggest.prototype.SetSuggestions = function( rgSuggestions )
{
	var strLastFocus = this.m_strLastFocusVal;

	this.m_$Suggestions.empty();

	this.m_$Focus = $J();
	this.m_strLastFocus = null;

	if ( rgSuggestions && rgSuggestions.length )
	{
		var _this = this;
		for ( var i = 0; i < rgSuggestions.length; i++ )
		{
			var $Suggestion = $J('<div/>', {'class': 'suggestion_item popup_menu_item' } );
			$Suggestion.text( rgSuggestions[i] );
			$Suggestion.click( $J.proxy( this.OnSuggestionSelected, this, $Suggestion ) );
			$Suggestion.mouseenter( $J.proxy( this.SetFocus, this, $Suggestion ) );

			this.m_$Suggestions.append( $Suggestion );

			if ( rgSuggestions[i] == strLastFocus )
				this.SetFocus( $Suggestion );
		}
		this.m_bHaveSuggestions = true;
		this.ShowSuggestions();
	}
	else
	{
		this.m_bHaveSuggestions = false;
		this.HideSuggestions();
	}
};

CTextInputSuggest.prototype.OnTextChanged = function( event )
{
	if ( event && ( event.which == 13 || event.which == 27 ) )
		return;

	var value = this.m_$Input.val();
	if ( value != this.m_strLastVal )
	{
		var _this = this;
		this.m_fnSuggestForTerm( value, function( rgSuggestions ) { _this.SetSuggestions( rgSuggestions ); } );
		this.m_strLastVal = value;
	}
};

CTextInputSuggest.prototype.OnKeyDown = function( event )
{
	if ( event.which == 27 )
	{
		this.HideSuggestions();
	}
	else if ( this.m_bHaveSuggestions )
	{
		var $NewSuggestion = null;
		if ( event.which == 13 )
		{
			if ( this.m_$Focus.length && this.m_bHaveSuggestions )
			{
				this.OnSuggestionSelected( this.m_$Focus );
				event.stopPropagation();
				event.preventDefault();
			}
		}
		else if ( event.which == 38 /* up arrow */ )
		{
			event.preventDefault();
			if ( this.m_$Focus.length )
				$NewSuggestion = this.m_$Focus.prev();
			if ( !$NewSuggestion )
				$NewSuggestion = this.m_$Suggestions.children().last();
		}
		else if ( event.which == 40 /* down arrow */ )
			{
				event.preventDefault();
				if ( this.m_$Focus.length )
					$NewSuggestion = this.m_$Focus.next();
				if ( !$NewSuggestion )
					$NewSuggestion = this.m_$Suggestions.children().first();
			}

		if ( $NewSuggestion )
			this.SetFocus( $NewSuggestion );
	}
};

CTextInputSuggest.prototype.SetFocus = function( $Suggestion )
{
	this.m_$Focus.removeClass( 'focus' );
	this.m_$Focus = $Suggestion;
	this.m_$Focus.addClass( 'focus' );
	this.m_strLastFocusVal = $Suggestion.text();
};

CTextInputSuggest.prototype.Destroy = function()
{
	this.m_$SuggestionsCtn.remove();
	this.m_$Input.off( '.CTextInputSuggest' );
};

/**
 * Similar to CTextInputSuggest, but uses associative arrays instead of just text; useful for when we may have more than one
 * item with the same text name, or when you want to use HTML in the item name instead of just plaintext
 *
 * Each suggestion should include a 'key', and one of the following:
 * text - Suggestion text (escaped, sets textContents)
 * html - Raw suggestion html (NOT ESCAPED, sets innerHTML)
 *
 * @param $InputElement
 * @param fnSuggestForTerm
 * @param fnOnSuggest
 * @constructor
 */
function CIndexedInputSuggest( $InputElement, fnSuggestForTerm, fnOnSuggest, strCssClass )
{
	this.Init( $InputElement, fnSuggestForTerm, fnOnSuggest, strCssClass );
}

CIndexedInputSuggest.prototype = Object.create(CTextInputSuggest.prototype);;

CIndexedInputSuggest.prototype.OnSuggestionSelected = function( $Suggestion )
{
	this.m_$Input.val( $Suggestion.text() );

	this.m_bHaveSuggestions = false;
	this.m_$Focus = $J();
	this.HideSuggestions();

	this.m_fnOnSuggest( $Suggestion.data('suggest-key'), $Suggestion.text() );
};

CIndexedInputSuggest.prototype.SetSuggestions = function( rgSuggestions )
{
	var strLastFocus = this.m_strLastFocusVal;

	this.m_$Suggestions.empty();

	this.m_$Focus = $J();
	this.m_strLastFocus = null;

	if ( rgSuggestions && rgSuggestions.length )
	{
		var _this = this;
		for ( var i = 0; i < rgSuggestions.length; i++ )
		{

			var $Suggestion = $J('<div/>', {'class': 'suggestion_item popup_menu_item' } );
			if( rgSuggestions[i].text )
				$Suggestion.text( rgSuggestions[i].text );
			else if( rgSuggestions[i].html )
				$Suggestion.html( rgSuggestions[i].html );

			$Suggestion.data('suggest-key', rgSuggestions[i].key )

			$Suggestion.click( $J.proxy( this.OnSuggestionSelected, this, $Suggestion ) );
			$Suggestion.mouseenter( $J.proxy( this.SetFocus, this, $Suggestion ) );

			this.m_$Suggestions.append( $Suggestion );

			if ( rgSuggestions[i] == strLastFocus )
				this.SetFocus( $Suggestion );
		}
		this.m_bHaveSuggestions = true;
		this.ShowSuggestions();
	}
	else
	{
		this.m_bHaveSuggestions = false;
		this.HideSuggestions();
	}
};

function InitBBCodeVideos( bAllowAutoPlay )
{
	var videos = $J( "video" );
	if ( videos.length != 0 )
	{
		for ( var i = 0; i < videos.length; ++i )
		{
			var video = videos[i];
			var $video = $J( video );

			if ( $video.hasClass("bb_video_loop") )
			{
				video.setAttribute('loop', 'loop');
			}

			if ( $video.hasClass("bb_video_controls") )
			{
				video.setAttribute( 'controls', 'controls' );
			}

			if ( bAllowAutoPlay )
			{
				$video.unbind('mouseenter mouseleave');

				video.preload = $video.hasClass("bb_video_preload") ? 'auto' : 'metadata';

				if ( $video.hasClass("bb_video_autoplay") )
				{
					video.autoplay = 'autoplay';
				}
			}
			else
			{
				video.preload = 'metadata';
				$video.hover( function toggleControls() {
					if ( this.hasAttribute("controls") ) {
						this.removeAttribute("controls")
					} else {
						this.setAttribute("controls", "controls")
					}
				} );
			}
		}
	}
}


function LoginUsingSteamClient( baseURL )
{
	var lastLogin = V_GetCookie('lastAutoLogin');
	if ( !lastLogin )
	{
		V_SetCookie('lastAutoLogin', '1', 1 / 24); // only try auto login once an hour
		if ('withCredentials' in new XMLHttpRequest()) { // make sure the browser respects CORS
			$J.ajax({
				type: "GET",
				url: 'http://localhost:27060/auth/?u=public',
				dataType: "json",
				success: function (data) {
					$J.ajax({
						type: "POST",
						url: baseURL + '/login/checkclientautologin',
						data: {
							'steamid': data['steamid'],
							'sessionkey': data['sessionkey'],
							'encrypted_loginkey': data['encrypted_loginkey'],
							'digest': data['digest'],
							'redirectURL': window.location.href
						},
						dataType: "json",
						success: function (data) {
							location.reload();
						}
					});
				}
			});
		}
	}
}



/**
 * Generic interface for handling ajax-driven sub-pages.
 *
 * @param elTarget Element to dump content into
 * @param strBaseURL Base URL to attach nav params
 * @param strInstanceId Unique flag to look for when scanning for state change events. also determines our data selector
 * 						Only needed if you're using more than one CAjaxSubPageController on the same page.
 * @constructor
 */
var CAjaxSubPageController = function( elTarget, strBaseURL, strInstanceId, strDefaultLocation )
{
	this.elTarget = elTarget;
	this.strBaseURL = strBaseURL;
	this.strStateID = strInstanceId || 'navid';
	this.strDefaultLocation = strDefaultLocation || '';

	this.rgOriginalEvent = {'html':this.elTarget.innerHTML,'title':document.title, 'id': this.strStateID};

	window.addEventListener('popstate', this.OnWindowPopState.bind(this));

	this.InstrumentLinks( document );

	var _this = this;
	setTimeout( function(){ $J(_this.elTarget).children().trigger('load'); }, 1);

	var strLocation =  window.location.href.substring(strBaseURL.length);
	this.PaintLinks(strLocation || this.strDefaultLocation);


};

/**
 * Register click handlers. This also sets the href for browser link preview and fallback for non-click navigation
 * events, such as opening in a new tab/window via middle click.
 * @param elTarget Element to query from.
 * @constructor
 */
CAjaxSubPageController.prototype.InstrumentLinks = function( elTarget )
{
	//var rgLinks = elTarget.querySelectorAll('[data-'+this.strStateID+']');
	var rgLinks = $J('[data-'+this.strStateID+']', elTarget);
	for( var i=0; i<rgLinks.length; i++)
	{
		rgLinks[i].addEventListener('click', this.Navigate.bind(this, rgLinks[i].dataset[ this.strStateID ], rgLinks[i].dataset[ 'title' ] ) );
		rgLinks[i].href = this.strBaseURL + rgLinks[i].dataset[ this.strStateID ];
	}
	BindStoreTooltip( $J('[data-store-tooltip]', elTarget ) );
}

/**
 * Adds 'active' class to link that was clicked or is currently active.
 * @constructor
 */
CAjaxSubPageController.prototype.PaintLinks = function( strLocation )
{
	// Figure out which link we clicked and paint it with the correct class
	var rgLinks = document.querySelectorAll('[data-'+this.strStateID+']');
	for( var i=0; i<rgLinks.length; i++)
	{
		if( rgLinks[i].dataset[ this.strStateID ] == strLocation )
			rgLinks[i].classList.add('active');
		else
			rgLinks[i].classList.remove('active');
	}
}

/**
 * Call to navigate the sub-frame.
 *
 * @param strLocation Assumed to be strBaseURL + strLocation. Trailing slash should be on strBaseURL already.
 * @param strpageTitle Optional: Replace page title with this new value.
 * @constructor
 */
CAjaxSubPageController.prototype.Navigate = function( strLocation, strPageTitle, event )
{
	var _this = this;
	var strURL = this.strBaseURL + strLocation;

	this.elTarget.classList.add('loading');

	this.PaintLinks( strLocation );

	// Trigger the "saveform" event which we may have bound to do things.
	$J( 'form', this.elTarget ).trigger('saveform');

	$J.ajax({
		url: strURL,
		dataType: "html",
		cache: true, /* Let the browser decide caching rules */
		data: { 'ajax': 1 }
	}).done(function( result ) {

		var elNewContents = $J( result );

		$J(_this.elTarget).empty();
		$J(_this.elTarget).append( elNewContents );


		_this.elTarget.classList.remove('loading');

		$J( elNewContents ).trigger('load');

		_this.InstrumentLinks( _this.elTarget );
		if( strPageTitle )
			document.title = strPageTitle;

		$J('.tooltip', _this.elTarget).v_tooltip();

		window.history.pushState({'html':result,'title':strPageTitle, 'id': _this.strStateID}, '', strURL );
	});

	if( event )
		event.preventDefault();

};

/**
 * Internal event handler for the "back" button.
 * @param Event event
 * @constructor
 */
CAjaxSubPageController.prototype.OnWindowPopState = function( event )
{
	// Revert to our original state if there's nothing in the stack.

	if(event.state == null)
	{
		event.state = 5;
	}

	var state = event.state || this.rgOriginalEvent;

	if( state && state.id == this.strStateID)
	{
		var strLocation =  window.location.href.substring(this.strBaseURL.length);
		this.PaintLinks( strLocation );

		var elNewContents = $J(state.html);
		$J(this.elTarget).empty();
		$J(this.elTarget).append(elNewContents);
		if( state.title )
			document.title = state.title;

		$J( elNewContents ).trigger('load');
		this.InstrumentLinks( elNewContents );
	}
};



$J = jQuery.noConflict();
if ( typeof JSON != 'object' || !JSON.stringify || !JSON.parse ) {
    document.write( "<scr" + "ipt type=\"text\/javascript\" src=\"http:\/\/community.edgecast.steamstatic.com\/public\/javascript\/json2.js?v=pmScf4470EZP&amp;l=english\" ><\/script>\n" );
};

/* handle modal content */
var modalContent = {};
var activeContent;
var bodyClassName = "";
var resizeActiveContentTimer = null;
var g_bModalModifyAnchorTargets = true;
var g_bModalCacheContent = true; // whether or not to reuse old iframes when opening a modal with a previously visited URL

function OnModalContentDismissal()
{
	document.body.style.overflow = '';
	$('modalContentScrollbarHack').hide();
	if ( $('ModalContentContainer') )
		$('ModalContentContainer').className = bodyClassName;
	if ( activeContent.contentWindow.onModalHidden )
	{
		activeContent.contentWindow.onModalHidden();
	}
	// for now, if the window has embedded objects, like YouTube videos,
	// remove the child to stop the video
	if ( activeContent.contentWindow.document.getElementsByTagName( "object" ).length > 0 || activeContent.contentWindow.document.getElementsByTagName( "iframe" ).length > 0 || !g_bModalCacheContent )
	{
		$('modalContentFrameContainer').removeChild( activeContent );
		modalContent[activeContent.src] = null;
	}
	else if ( !modalContent[activeContent.src] )
	{
		$('modalContentFrameContainer').removeChild( activeContent );
	}
	activeContent = null;

	$('modalContent').fire( 'modalContent:dismissed' );
}

function InnerAnchorClickHandler_Deferred()
{
	PollResizeActiveModalContent();
	HookAnchors();
}

function InnerAnchorClickHandler()
{
	setTimeout( InnerAnchorClickHandler_Deferred, 1 );
}

function HookAnchors()
{
	// the modal may have been closed by the time we get here
	if ( !activeContent )
		return;

	if ( g_bModalModifyAnchorTargets )
	{
		var anchorTags;
		try
		{
			anchorTags = activeContent.contentDocument.getElementsByTagName('a');
		}
		catch( err )
		{
			// We probably navigated off domain and don't have permission. Dang.
			return;
		}

		for( var i = 0; i < anchorTags.length; i++ )
		{
			var anchorTag = anchorTags[i];

			if ( anchorTag.target == "" )
			{
				anchorTag.target = '_top';
			}
		}
	}

	Event.observe( activeContent.contentDocument.body, 'click', InnerAnchorClickHandler );
}

modalContentLoaded = false;
function OnModalContentLoaded()
{
	if ( modalContentLoaded )
		return;

	modalContentLoaded = true;
	HookAnchors();

	$( 'modalContentWait' ).hide();
	modalContent[activeContent.src] = activeContent;
	activeContent.show();
	SizeModalContent( activeContent );
}

function OnModalContentFullyLoaded()
{
	OnModalContentLoaded(); //catch any pages that haven't been updated
	if ( $(activeContent).contentDocument.body.setStyle )
		$(activeContent).contentDocument.body.setStyle( { 'overflow-x' : 'hidden' } );
	activeContent.forceResize = true;
	SizeModalContent( activeContent );
	resizeActiveContentTimer = setTimeout( PollResizeActiveModalContent, 100 );
}



function SizeModalContent( activeContent )
{
	if ( activeContent.sizeToFit )
	{
		SizeToFitScreen( activeContent );
		resizeActiveContentTimer = setTimeout( PollResizeActiveModalContent, 200 );
	}
	else
	{
		ResizeModalContent( activeContent );
	}
}

function SizeToFitScreen( elem )
{
	// defer, to give the iframe a chance to figure out its normal size
	SizeToFitScreen_Deferred.bind( null, elem ).defer();
}

// size width until the vertical scrollbar appears
function SizeToFitScreen_Deferred( elem )
{
	var viewport = document.viewport.getDimensions();
	var windowWidth = viewport.width;
	var windowHeight = viewport.height;

	// if we've already calculated the width, we don't need to do this again
	if ( ( !elem.forceResize ) && typeof elem.lastWidth != 'undefined' && typeof elem.lastHeight != 'undefined' && elem.lastWindowWidth == windowWidth && elem.lastWindowHeight == windowHeight )
	{
		$('modalContent').style.width =  elem.lastWidth + 'px';
		$('modalContent').style.height =  elem.lastHeight + 'px';
		modalSizing( $('modalContent') );
		return false;
	}

	elem.forceResize = false;

	var maxWidth = Math.floor( windowWidth * 0.95 );
	var maxHeight = Math.max( 300, Math.floor( windowHeight * 0.95 ) );

	// size up content, but keep aspect ratio
	var contentWidth = $(elem).contentDocument.body.offsetWidth;
	var contentHeight = $(elem).contentDocument.body.offsetHeight;
	var aspectRatio = contentWidth / contentHeight;

	var titleBarHeight = 0;
	if ( $('modalContentTitleBar').visible() )
	{
		titleBarHeight = $('modalContentTitleBar').getHeight();
	}

	// first try to set window at maximum width and figure out what that new height would be, including
	// title bar and borders
	var newWidth = maxWidth;
	var newHeight = Math.floor( newWidth / aspectRatio );// + titleBarHeight + 4;

	if ( newHeight > maxHeight )
	{
		newHeight = maxHeight;
		newWidth = Math.floor( newHeight * aspectRatio );
	}

	// remove borders
	newWidth += 12;	/* some space for scrollbar in firefox */
	$('modalContent').style.width = newWidth + 'px';

	var resized = ResizeModalContent( elem );

	elem.lastWindowWidth = windowWidth;
	elem.lastWindowHeight = windowHeight;
	elem.lastWidth = newWidth;
	elem.lastHeight = $('modalContent').getHeight();

	return resized;
}

function PollResizeActiveModalContent()
{
	if ( !activeContent || !activeContent.visible() )
		return;

	var resized = false;

	if ( activeContent.sizeToFit )
	{
		resized = SizeToFitScreen( activeContent );
	}
	else
	{
		resized = ResizeModalContent( activeContent );
	}

	if ( resized )
	{
		resizeActiveContentTimer = setTimeout( PollResizeActiveModalContent, 100 );
	}
}

function ResizeModalContent( elem )
{
	// the content window should be at most 90% of the usable window height
	var viewport = document.viewport.getDimensions();
	var windowHeight = viewport.height;
	var windowWidth = viewport.width;
	var minHeight = 300;
	var contentHeight = $(elem).contentDocument.body.scrollHeight;
	var desiredHeight = Math.min( contentHeight, Math.max( minHeight, Math.floor( windowHeight * 0.95 ) ) );
	var dialogHeight = desiredHeight;
	var titleBarHeight = 0;
	if ( $('modalContentTitleBar').visible() )
	{
		titleBarHeight = $('modalContentTitleBar').getHeight();
		dialogHeight += titleBarHeight;
	}
	var oldDialogHeight = $( 'modalContent' ).getHeight() - 4; // include the 2px border on top and bottom
	var oldFrameContainerHeight = $( 'modalContentFrameContainer' ).getHeight();
	var oldContentHeight = $( elem ).getHeight();
	if ( oldDialogHeight == dialogHeight && oldFrameContainerHeight == desiredHeight && oldContentHeight == contentHeight )
		return false;


	$( 'modalContent' ).style.height = dialogHeight + 'px';
	$( 'modalContentFrameContainer' ).style.height = desiredHeight + 'px';

	var $Modal = $J('#modalContent');
	if ( $Modal.width() > windowWidth * 0.95 )
	{
		if ( !$Modal.data('origWidth') )
			$Modal.data( 'origWidth', $Modal.width() );
		$('modalContent' ).style.width = Math.max( 310, Math.floor( windowWidth * 0.95 ) ) + 'px';
	}
	else if ( $Modal.data('origWidth') && $Modal.data('origWidth') > $Modal.width() )
	{
		$('modalContent' ).style.width = Math.min( $Modal.data('origWidth'), Math.floor( windowWidth * 0.95 ) ) + 'px';
	}

	//$( elem ).style.height = contentHeight + 'px';
	$( elem ).style.height = desiredHeight + 'px';
	// re-center
	modalSizing( $('modalContent') );
	return true;
}

function ShowModalContent( url, titleBarText, titleBarURL, sizeToFit )
{
	var bIsPanorama = false;

	if ( navigator.userAgent.match( /Valve Steam Tenfoot/i ) )
		bIsPanorama = true;

	var params = document.location.toString().toQueryParams();
	if ( typeof params.insideModal != 'undefined' || bIsPanorama )
	{
		// already inside a modal, go there directly
		window.parent.location.href = url.replace( "insideModal=1", "insideModal=0");
		return;
	}

	EnsureModalContentDivExists();
	// defer the display of the modal by a frame, so any click event which may have triggered this
	//	has finished propagation
	ShowModalContent_Deferred.bind( null, url, titleBarText, titleBarURL, typeof sizeToFit != 'undefined' && sizeToFit ).defer();
}

function ShowModalContent_Deferred( url, titleBarText, titleBarURL, sizeToFit )
{
	EnsureModalContentDivExists();

	sizeToFit = typeof sizeToFit != 'undefined' && sizeToFit;
	// reset dialog width and height and show it in the waiting state
	$( 'modalContent' ).style.width = '990px';
	$( 'modalContent' ).style.height = '';
	showModal( 'modalContent', false, false );
	$( 'modalContent').OnModalDismissal = OnModalContentDismissal;
	$( 'modalContentFrameContainer' ).childElements().invoke( 'hide' );
	$( 'modalContent' ).childElements().invoke( 'hide' );
	$( 'modalContentWait' ).show();

	// set up the titlebar if applicable
	if ( typeof titleBarText != 'undefined' &&
		 typeof titleBarURL != 'undefined' )
	{
		$('modalContentTitleBar').show();
		$('modalContentTitleBarLink').href = titleBarURL;
		$('modalContentTitleBarImageLink').href = titleBarURL;
		$('modalContentTitleBarLink').innerHTML = titleBarText;
	}
	else
	{
		$('modalContentTitleBar').hide();
	}

	// hide the scrollbar and show our fake scrollbar
	document.body.style.overflow = 'hidden';
	if ( $('ModalContentContainer') )
	{
		bodyClassName = $('ModalContentContainer').className;
		$('ModalContentContainer').className = "modalBody";
	}
	$('modalContentScrollbarHack').show();
	$('modalContentDismiss').show();

	// look up the cached iframe and show it or create a new one
	if ( modalContent[url] )
	{
		$( 'modalContentWait' ).hide();
		modalContent[url].show();
		SizeModalContent( modalContent[url] );
		activeContent = modalContent[url];
		resizeActiveContentTimer = setTimeout( PollResizeActiveModalContent, 100 );
	}
	else
	{
		modalContentLoaded = false;
		iframeContent = new Element( 'iframe', { 'class' : 'modalContent_iFrame', 'onLoad' : 'OnModalContentFullyLoaded()', 'style' : 'display: none;', 'scrolling' : sizeToFit ? 'no' : 'auto' } );
		iframeContent.src = url;
		activeContent = iframeContent;
		activeContent.sizeToFit = sizeToFit;
		$( 'modalContentFrameContainer' ).appendChild( iframeContent );
		$( 'modalContentFrameContainer' ).style.height = 0 + 'px';
	}
	$( 'modalContentFrameContainer' ).show();

	return false;
}

function HideModalContent()
{
	if ( $( 'modalContent' ) )
	{
		hideModal( 'modalContent' );
	}
}

function EnsureModalContentDivExists()
{
	if ( !$('modalContent') )
	{
				$(document.body).insert( {bottom: "<div id=\"modalContentScrollbarHack\" style=\"display: none\"><\/div>\r\n\r\n<div id=\"modalContent\" class=\"modal_frame\" style=\"display: none\">\r\n\t<div id=\"modalContentTitleBar\">\r\n\t\t<a id=\"modalContentTitleBarLink\" href=\"\" target=\"_blank\">&nbsp;<\/a>\r\n\t\t<a id=\"modalContentTitleBarImageLink\" href=\"\" target=\"_blank\"><img src=\"http:\/\/community.edgecast.steamstatic.com\/public\/images\/skin_1\/ico_external_link.gif\" alt=\"\"><\/a>\r\n\t\t<div id=\"modalContentDismiss\" class=\"modalContentDismissImage\" onclick=\"HideModalContent();\">\r\n\t\t\t<img src=\"http:\/\/community.edgecast.steamstatic.com\/public\/images\/x9x9.gif\" width=\"9\" height=\"9\" border=\"0\" alt=\"Close\">\r\n\t\t<\/div>\r\n\t<\/div>\r\n\t<div id=\"modalContentWait\"><img src=\"http:\/\/community.edgecast.steamstatic.com\/public\/images\/login\/throbber.gif\" alt=\"Loading\"><\/div>\r\n\t<div id=\"modalContentFrameContainer\"><\/div>\r\n<\/div>" });
	}
}


$J( function($) {

	$(window ).on('resize.modalContent', PollResizeActiveModalContent );

	var s_bInTouchEvent = false;
	$(document ).on('touchstart.modalContent', 'a.modalContentLink, div.modalContentLink', function( e ) {
		s_bInTouchEvent = true;
	});
	$(document ).on('click.modalContent', 'a.modalContentLink, div.modalContentLink', function( e ) {
		var $Link = $( e.currentTarget );
		var bIsAnchor = $Link.is('a');

		// if it's not a left click (middle or right click) just continue
		if ( bIsAnchor && ( s_bInTouchEvent || ( e.which && e.which != 1 ) ) )
		{
			s_bInTouchEvent = false;
			return;
		}

		// show as a modal popup
		if ( bIsAnchor )
			e.preventDefault();

		var strURL = $Link.data('modalContentUrl');
		if ( !strURL )
		{
			strURL = $Link.attr('href');
		}

		if ( window.location.href.indexOf("https://") == 0 )
		{
			strURL = strURL.replace( "http://", "https://" );
		}

		// if they are touching a div, just navigate to the item url
		if ( s_bInTouchEvent )
		{
			s_bInTouchEvent = false;
			window.location = strURL;
			return;
		}

		var strModalURL = $Link.data('modalContentPopupUrl');
		if ( !strModalURL )
			strModalURL = strURL + ( strURL.indexOf( "?" ) != -1 ? '&' : '?' ) + 'insideModal=1';

		var strTitle = $( e.currentTarget ).data('modalContentTitle');
		if ( !strTitle )
			strTitle = V_EscapeHTML( strURL );

		var bSizeToFit = $( e.currentTarget ).data('modalContentSizetofit');
		if ( typeof bSizeToFit == 'undefined' )
			bSizeToFit = true;

		ShowModalContent( strModalURL, strTitle, strURL, bSizeToFit );

	});
});
var g_fnModalDismissHandler = false;
var g_bIsMobileController = false;

function showGotSteamModal( contentEl, steamURL, appName )
{
	$('gotSteam_SteamURL').href = steamURL;
	$('gotSteam_AppName').update( appName );
	showModal( contentEl );
}

function showContentAsModal( idModal, elContent, bExplicitDismissalOnly )
{
	var elModal = $(idModal);
	var elModalContent = elModal.down('.modal_box_ctn');

	if ( elContent.parentNode != elModalContent )
	{
		if ( elContent.parentNode )
			elContent.remove();

		elModalContent.appendChild( elContent );
	}
	elContent.siblings().invoke('hide');
	elContent.show();
	
	showModal( elModal, bExplicitDismissalOnly );
}

function showModal( contentEl, bExplicitDismisalOnly, bIgnoreResizeAndScrollEvents )
{
	var cEl = $(contentEl);
	if ( cEl.is_visible_modal )
	{
		modalSizing( cEl, true );
		return;
	}

	var bgEl = $('modalBG');
	if(!bgEl)
	{
		bgEl = document.createElement('div');
		$J(document.body ).append(bgEl);
		bgEl.id = 'modalBG';
	}
	if ( bgEl.effect )
		bgEl.effect.cancel();
	bgEl.setOpacity( 0 );
	bgEl.effect = new Effect.Appear( bgEl, { from: 0.0, to: 0.7, duration: 0.4 } );


	// make sure we're save to position relative to body
	if ( cEl.parentNode != document.body )
		$(document.body).appendChild( cEl );

	cEl.show();

	if ( !g_bIsMobileController )
	{
		modalSizing( cEl, true );

		cEl.sizingListener = modalSizing.bind( null, cEl, false );
	}

	// skip registering the resize/scroll events on iphone as we don't calculate the position correctly
	if ( !Prototype.Browser.MobileSafari && !g_bIsMobileController && ( bIgnoreResizeAndScrollEvents == null || bIgnoreResizeAndScrollEvents == false ) )
	{
		Event.observe( window, 'resize', cEl.sizingListener );
		Event.observe( window, 'scroll', cEl.sizingListener );
	}
	
	if ( !bExplicitDismisalOnly )
	{
		cEl.identify(); 	//ask prototype to generate an id
		(function () {
			g_fnModalDismissHandler = RegisterPopupDismissal( hideModal.bind( null, cEl ), cEl, true );
		}).defer();
	}

	cEl.is_visible_modal = true;
}

function modalSizing( cEl, bFirst )
{
	var flInverseZoom = 1 / (document.body.style.zoom || 1);
	var w = document.viewport.getWidth() * flInverseZoom;
	var h = document.viewport.getHeight() * flInverseZoom;
	var sl = document.viewport.getScrollOffsets().left;
	var st = document.viewport.getScrollOffsets().top;

	var cw = cEl.offsetWidth;
	var ch = cEl.offsetHeight;


	var t = (Math.floor((h / 2) - (ch / 2)) + st);
	var l = (Math.floor((w / 2) - (cw / 2)) + sl);

	if ( ch < document.viewport.getHeight() )
		cEl.style.top = (t < 0 ? 0 : t) + 'px';
	else if ( bFirst )
		cEl.style.top = st + 'px';

	if ( cw < document.viewport.getWidth() )
		cEl.style.left = (l < 0 ? 0 : l ) + 'px';
	else if ( bFirst )
		cEl.style.left = sl + 'px';
}

function hideModal(contentEl)
{
	var cEl = $(contentEl);

	if ( !cEl.is_visible_modal )
		return;
	
	var bgEl = $('modalBG');
	if ( bgEl.effect )
		bgEl.effect.cancel();
	bgEl.effect = new Effect.Fade( bgEl, { duration: 0.2 } );
	cEl.hide();
	
	currentModal = false;


	if ( !Prototype.Browser.MobileSafari )
	{
		Event.stopObserving( window, 'resize', cEl.sizingListener );
		Event.stopObserving( window, 'scroll', cEl.sizingListener );
	}
	if ( g_fnModalDismissHandler ) 
	{
		g_fnModalDismissHandler.unregister();
		g_fnModalDismissHandler = false;
	}
	
	if ( cEl.OnModalDismissal )
		cEl.OnModalDismissal();

	cEl.is_visible_modal = false;
}

function modalAlert(msg)
{
	modalEl = document.getElementById('modalAlert');
	if(modalEl)
	{
		for(x=0;x<modalEl.childNodes.length;x++)
		{
			modalEl.removeChild(modalEl.childNodes[x]);
		}
		modalEl.parentNode.removeChild(modalEl);
	}
	
	modalEl = document.createElement('div');
	
}




/* returns a jquery deferred object, .done() means an invite was sent (or attempted), .fail() indicates they dismissed the modal */
function PresentGroupInviteOptions( rgFriendsToInvite )
{
	// this deferred will succeed if an invite is succesfully sent, fail if the user dismisses the modal or the invite AJAX fails
	var deferred = new jQuery.Deferred();

	var Modal = ShowDialog( 'Invite to Join Your Group', '<div class="group_invite_throbber"><img src="http://community.edgecast.steamstatic.com/public/images/login/throbber.gif"></div>' );
	var $ListElement = $J('<div/>', {'class': 'newmodal_content_innerbg'} );

	var bBulkFriendInvite = false;
	var steamIDInvitee = g_rgProfileData['steamid'];
	var strProfileURL = g_rgProfileData['url'];

	// see if this is a request to bulk invite a group of friends
	if ( rgFriendsToInvite && rgFriendsToInvite instanceof Array )
	{
		if ( rgFriendsToInvite.length == 1 )
		{
			steamIDInvitee = rgFriendsToInvite[0];
			strProfileURL = 'http://steamcommunity.com/profiles/' + steamIDInvitee + '/';
		}
		else
		{
			// true bulk invite
			steamIDInvitee = rgFriendsToInvite;
			bBulkFriendInvite = true;
		}
	}

	// if the modal is dismissed , we'll cancel the deferred object.  We capture this in a closure so that we can dismiss the modal without affecting
	//	the deferred object if the user actually picks something (in which case the deferred object will be the success of the AJAX invite action)
	var fnOnModalDismiss = function() { deferred.reject() };

	$J.get( strProfileURL + 'ajaxgroupinvite?new_profile=1' + ( bBulkFriendInvite ? '&bulk=1' : '' ), function( html ) {
		Modal.GetContent().find( '.newmodal_content').html('');	// erase the throbber
		Modal.GetContent().find( '.newmodal_content').append( $ListElement );
		$ListElement.html( html );
		Modal.AdjustSizing();
		$ListElement.children( '.group_list_results' ).children().each( function () {
			var groupid = this.getAttribute( 'data-groupid' );
			if ( groupid )
			{
				$J(this).click( function() {
					fnOnModalDismiss = function () {;};	// don't resolve the deferred on modal dismiss anymore, user has picked something
					InviteUserToGroup( Modal, groupid, steamIDInvitee)
					.done( function() { deferred.resolve(); } )
					.fail( function() { deferred.reject(); } );
				} );
			}
		});
	});

	Modal.done( function() {fnOnModalDismiss();} );

	return deferred.promise();
}

function InviteUserToGroup( Modal, groupID, steamIDInvitee )
{
	var params = {
		json: 1,
		type: 'groupInvite',
		group: groupID,
		sessionID: g_sessionID
	};

	if ( steamIDInvitee instanceof Array )
		params.invitee_list = V_ToJSON( steamIDInvitee );
	else
		params.invitee = steamIDInvitee;

	return $J.ajax( { url: 'http://steamcommunity.com/actions/GroupInvite',
		data: params,
		type: 'POST'
	} ).done( function( data ) {
		Modal && Modal.Dismiss();

		var strMessage = 'Invitation Sent!';
		ShowAlertDialog( 'Invite to Join Your Group', strMessage );
	}).fail( function( data ) {
		Modal && Modal.Dismiss();

		var rgResults = data.responseJSON;

        var strAccountListTable = '';
		if ( rgResults.rgAccounts )
		{
            strAccountListTable = '<table class="clanInviteErrorTable" ><thead><tr><th class="inviteTablePersona" >Invited Player</th><th class="inviteTableError">Error</th></tr></thead><tbody>';
			$J.each( rgResults.rgAccounts, function( accountid, rgError ){
                strAccountListTable += '<tr>';
                strAccountListTable += '<td class="inviteTablePersona">' + rgError.persona + '</td>';
                strAccountListTable += '<td class="inviteTableError">' +rgError.strError + "</td>";
                strAccountListTable += '</tr>';
			} );
            strAccountListTable += '</tbody></table>';
		}
		ShowAlertDialog( 'Error', rgResults.results ? rgResults.results + strAccountListTable : 'Error processing your request. Please try again.' );
	});
}

function RemoveFriend()
{
	var steamid = g_rgProfileData['steamid'];
	var strPersonaName = g_rgProfileData['personaname'];

	ShowConfirmDialog( 'Remove friend',
		'Are you sure you want to remove %s from your friend list?'.replace( /%s/, strPersonaName ),
		'Remove friend'
	).done( function() {
		$J.post(
			'http://steamcommunity.com/actions/RemoveFriendAjax',
			{sessionID: g_sessionID, steamid: steamid }
		).done( function() {
			ShowAlertDialog( 'Remove friend',
				'%s has been removed from your friends list.'.replace( /%s/, strPersonaName )
			).done( function() {
				// reload the page when they click OK, so we update friend state
				window.location.reload();
			} );
		} ).fail( function() {
			ShowAlertDialog( 'Remove friend',
				'Error processing your request. Please try again.'
			);
		} );
	} );
}

// also used for accepting friend invites
function AddFriend( bRespondingToInvite, steamid_friend, strPersonaName_friend )
{
	var steamid = steamid_friend ? steamid_friend : g_rgProfileData['steamid'];
	var strPersonaName = strPersonaName_friend ? strPersonaName_friend : g_rgProfileData['personaname'];

	$J.post(
		'http://steamcommunity.com/actions/AddFriendAjax',
		{sessionID: g_sessionID, steamid: steamid, accept_invite: bRespondingToInvite ? 1 : 0 }
	).done( function() {
		if ( !bRespondingToInvite )
		{
			ShowAlertDialog( 'Add Friend' + ' - ' + strPersonaName,
				'Friend invite sent. They will appear as a friend once they have accepted your invite.'
			);
		}
		else
		{
			ShowAlertDialog( 'Accept Friend Request',
				'Friend request accepted'
			).done( function() { window.location.reload(); } );
		}
	} ).fail( function( jqXHR  ) {

		var failedInvites = jqXHR.responseJSON['failed_invites_result'];

		if ( failedInvites === undefined )
		{
			ShowAlertDialog( 'Add Friend',
				'Error adding friend. Please try again.'
			);
			return;
		}

		// defaults
		var strTitle = 'Add Friend';
		var strMessage = 'Error adding friend. Please try again.';

		switch ( failedInvites[0] )
		{
			case 25:
				strMessage = 'Could not invite %s. Your friends list is full.';
				break;

			case 15:
				strMessage = 'Could not invite %s. Their friends list is full.';
				break;

			case 40:
				strMessage = 'Error adding Friend. Communication between you and this user has been blocked.';
				break;

			case 11:
				strMessage = 'You are blocking all communication with this user. Before communicating with this user, you must unblock them by visiting their Steam Community Profile.';
				break;

			case 84:
				strMessage = 'You\'ve sent too many invitations recently. Try again in a day or two.';
				break;

			case 24:
				strMessage = 'Your account does not meet the requirements to use this feature. <a class="whiteLink" href="https://help.steampowered.com/en/wizard/HelpWithLimitedAccount" target="_blank" rel="noreferrer">Visit Steam Support</a> for more information.';
				break;

			default:
				// default text is above
				break;
		}

		strMessage = strMessage.replace( /%s/, strPersonaName );
		ShowAlertDialog( strTitle, strMessage );

	} );
}

// ignore an invite; do not block the inviter
function IgnoreFriendInvite( steamid_friend, strPersonaName_friend )
{
	var steamid = steamid_friend ? steamid_friend : g_rgProfileData['steamid'];
	var strPersonaName = strPersonaName_friend ? strPersonaName_friend : g_rgProfileData['personaname'];

	$J.post(
		'http://steamcommunity.com/actions/IgnoreFriendInviteAjax',
		{sessionID: g_sessionID, steamid: steamid }
	).done( function() {
		ShowAlertDialog( 'Ignore Friend Request',
			'Friend request ignored'
		).done( function() { window.location.reload(); } );
	} ).fail( function() {
		ShowAlertDialog( 'Ignore Friend Request',
			'Error ignoring friend request. Please try again.'
		);
	} );
}

// block a user, with confirmation
function ConfirmBlock()
{
	var steamid = g_rgProfileData['steamid'];
	var strPersonaName = g_rgProfileData['personaname'];

	ShowConfirmDialog( 'Block All Communication',
		'You are about to block all communication with %s.'.replace( /%s/, strPersonaName ),
		'Yes, block them'
	).done( function() {
			$J.post(
				'http://steamcommunity.com/actions/BlockUserAjax',
				{sessionID: g_sessionID, steamid: steamid, block: 1 }
			).done( function() {
				ShowAlertDialog( 'Block All Communication',
					'You have blocked all communications with this player.'
				).done( function() {
					location.reload();
				} );
			} ).fail( function() {
				ShowAlertDialog( 'Block All Communication',
					'Error processing your request. Please try again.'
				);
			} );
		} );
}

// unblock a user, with confirmation
function ConfirmUnblock()
{
	var steamid = g_rgProfileData['steamid'];
	var strPersonaName = g_rgProfileData['personaname'];

	ShowConfirmDialog( 'Unblock All Communication',
	'You are about to unblock all communication with %s.'.replace( /%s/, strPersonaName ),
	'Yes, unblock them'
).done( function() {
	$J.post(
		'http://steamcommunity.com/actions/BlockUserAjax',
		{sessionID: g_sessionID, steamid: steamid, block: 0 }
	).done( function() {
		ShowAlertDialog( 'Unblock All Communication',
			'You have unblocked all communications with this player.'
		).done( function() {
			location.reload();
		} );
	} ).fail( function() {
		ShowAlertDialog( 'Unblock All Communication',
			'Error processing your request. Please try again.'
		);
	} );
} );
}

function InitProfileSummary( strSummary )
{
	var $Summary = $J( '.profile_summary' );
	var $SummaryFooter = $J( '.profile_summary_footer' );

	if ( $Summary[0].scrollHeight <= 76 )
	{
		$Summary.addClass( 'noexpand' );
		$SummaryFooter.hide();
	}
	else
	{
		var $ModalSummary = $J('<div/>', {'class': 'profile_summary_modal'}).html( strSummary );
		$SummaryFooter.find( 'span' ).click( function() {
			var Modal = ShowDialog( 'Info', $ModalSummary );
			window.setTimeout( function() { Modal.AdjustSizing(); }, 1 );
		} );
	}

}

function ShowFriendsInCommon( unAccountIDTarget )
{
	ShowPlayerList( 'Friends in Common', 'friendsincommon', unAccountIDTarget );
}

function ShowFriendsInGroup( unClanIDTarget )
{
	ShowPlayerList( 'Friends in Group', 'friendsingroup', unClanIDTarget );
}

function ShowPlayerList( title, type, unAccountIDTarget, rgAccountIDs )
{
	var Modal = ShowAlertDialog( title, '<div class="group_invite_throbber"><img src="http://community.edgecast.steamstatic.com/public/images/login/throbber.gif"></div>' );
	var $ListElement = $J('<div/>', {'class': 'player_list_ctn'} );
	var $Buttons = Modal.GetContent().find('.newmodal_buttons').detach();

	Modal.GetContent().css( 'min-width', 268 );

	var rgParams = {};
	if ( type )
		rgParams['type'] = type;
	if ( unAccountIDTarget )
		rgParams['target'] = unAccountIDTarget;
	if ( rgAccountIDs )
		rgParams['accountids'] = rgAccountIDs.join( ',' );

	$J.get( 'http://steamcommunity.com/actions/PlayerList/', rgParams, function( html ) {

		$ListElement.html( html );

		var $Content = Modal.GetContent().find( '.newmodal_content');
		$Content.html(''); // erase the throbber
		$Content.append( $ListElement );
		$Content.append( $Buttons );

		Modal.AdjustSizing();
		$ListElement.append();
	});
}

function ToggleManageFriends()
{
	if ( $J('#manage_friends_actions_ctn').is( ':hidden' ) )
	{
		$J('#manage_friends_btn').find( '.btn_details_arrow').removeClass( 'down').addClass( 'up' );
		$J('#manage_friends_actions_ctn').slideDown( 'fast' );
		$J('div.manage_friend_checkbox').show();
		$J('a.friendBlockLinkOverlay' ).on( 'click.manage_friends', function( event ) {
			if ( !event.which || event.which == 1 )
			{
				event.preventDefault();
				$J(this ).siblings('.manage_friend_checkbox' ).find('input[type=checkbox]' ).prop( 'checked', function( i, v ) { return !v; } );
			}
		});
	}
	else
	{
		$J('#manage_friends_btn').find( '.btn_details_arrow').removeClass( 'up').addClass( 'down' );
		$J('#manage_friends_actions_ctn').slideUp( 'fast' );
		$J('div.manage_friend_checkbox').hide();
		$J('a.friendBlockLinkOverlay' ).off( 'click.manage_friends' );
	}
}

function ManageFriendsInviteToGroup( $Form, groupid )
{
	$Form.find('input[type="checkbox"]');
	var rgFriendSteamIDs = [];
	$Form.find( 'input[type=checkbox]' ).each( function() {
		if ( this.checked )
			rgFriendSteamIDs.push( $J(this).attr( 'data-steamid' ) );
	} );
	if ( rgFriendSteamIDs.length > 0 )
	{
		if ( groupid )
		{
			// specific group
			InviteUserToGroup( null /* no modal window */, groupid, rgFriendSteamIDs ).done( function() {
				$Form.find('input[type=checkbox]').prop( 'checked', false );
			});
		}
		else
		{
			// ask the user which group to invite to
			PresentGroupInviteOptions( rgFriendSteamIDs).done( function() {
				$Form.find('input[type=checkbox]').prop( 'checked', false );
			});
		}
	}
	else
	{
		ShowAlertDialog( 'Invite to Join Your Group', 'You have not selected any friends.' );
	}
}

function ManageFriendsExecuteBulkAction( $Form, strActionName )
{
	if ( $Form.find('input[type=checkbox]:checked').length == 0 )
	{
		ShowAlertDialog( '', 'You have not selected any friends.' );
		return;
	}

	$Form.find('input[name=action]').val( strActionName );
	$Form.submit();
}

function ManageFriendsConfirmBulkAction( $Form, strActionName, strTitle, strSingluarDescription, strPluralDescription )
{
	var cFriendsSelected = $Form.find('input[type=checkbox]:checked').length;
	if ( cFriendsSelected == 0 )
	{
		ShowAlertDialog( strTitle, 'You have not selected any friends.' );
		return;
	}

	var strDescription = strSingluarDescription;
	if ( cFriendsSelected != 1 )
		strDescription = strPluralDescription.replace( /%s/, cFriendsSelected );

	ShowConfirmDialog( strTitle, strDescription).done( function() {
		ManageFriendsExecuteBulkAction( $Form, strActionName );
	});
}

function ManageFriendsBlock( $Form )
{
	ManageFriendsConfirmBulkAction( $Form, 'ignore', 'Block',
		'Are you sure you want to block this friend?' + ' ' + 'You will no longer be able to send or receive messages or invites with this player.',
		'Are you sure you want to block these %s friends?' + ' ' + 'You will no longer be able to send or receive messages or invites with these players.');
}

function ManageFriendsRemove( $Form )
{
	ManageFriendsConfirmBulkAction( $Form, 'remove', 'Remove Friend',
		'Are you sure you want to remove this friend?' + ' ' + 'This player will no longer appear in your friends list and you will not be able to communicate with them.',
		'Are you sure you want to remove these %s friends?' + ' ' + 'These players will no longer appear in your friends list and you will not be able to communicate with them.');
}

function ManageFollowingRemove( $Form )
{
	ManageFriendsConfirmBulkAction( $Form, 'removefollowing', 'Remove from your following list?',
		'Are you sure you want to stop following this person?',
		'Are you sure you want to stop following %s people?');
}

function ManageFriendsAddFriends( $Form )
{
	ManageFriendsConfirmBulkAction( $Form, 'addfriend', 'Add to friends list',
		'Are you sure you want to send a friend invite to the selected players? ',
		'Are you sure you want to send a friend invite to the selected players? '	);
}



var AliasesLoaded = false;
function ShowAliasPopup(e)
{
	ShowMenu( e, 'NamePopup', 'left' );

	if( AliasesLoaded )
		return true;

	var aliasContainer = $( 'NamePopupAliases' );

	var throbber = document.createElement( 'img' );
	throbber.src = 'http://community.edgecast.steamstatic.com/public/images/login/throbber.gif';
	aliasContainer.appendChild( throbber );

	new Ajax.Request( g_rgProfileData['url'] + 'ajaxaliases/', {
		method: 'post',
		parameters: { },
		onSuccess: function( transport ) {

			var Aliases = transport.responseJSON;

			if( !aliasContainer )
				return;

			aliasContainer.update('');

			if( !Aliases || Aliases.length == 0 )
				Aliases.push( {newname: "This user has no known aliases"} );

			for( var x=0; x<Aliases.length; x++ )
			{
				var c = Aliases[x];

				var curSpan = document.createElement( 'p' );
				var curATN = document.createTextNode( c['newname'] );
				curSpan.appendChild( curATN );
				aliasContainer.appendChild( curSpan );
			}

			AliasesLoaded = true;
		},
		onFailure: function( transport ) { alert( 'Please try again later' ); }
	} );
}


function IsValidNickname( str )
{
	return str.length == 0 || str.strip().length > 2;
}

function ShowNicknameModal( )
{
	// Show the dialogue
	ShowPromptDialog( "Add Nickname", "Add a persistent nickname to this player to keep track of who they are.", "Add Nickname", "Cancel" )
		.done( function( nickname, other ) {
			// User clicked 'OK', so we have a value; need to send it to the server
			$J.ajax( { url: g_rgProfileData['url'] + "ajaxsetnickname/",
				data: { nickname: nickname, sessionid: g_sessionID },
				type: 'POST',
				dataType: 'json'
			} ).done( function( data ) {
				// Got request result back, show it on the page
				if(data.nickname != undefined && data.nickname.length > 0)
				{
					$target = $J('.persona_name .nickname');
					// Add the nickname element if we don't already have one.
					if( $target.length == 0 )
						$target = $J('<span class="nickname"></span>').insertBefore( '.namehistory_link' );

					$target.text( "(" + data.nickname + ") " );
					$target.show();
				} else
					$J('.persona_name .nickname').hide();

			}).fail( function( data ) {
				ShowAlertDialog( '', data.results ? data.results : 'Error processing your request. Please try again.' );
			});

		}
	);
}

function SetFollowing( bFollowing, fnOnSuccess )
{
	var url = bFollowing ? g_rgProfileData['url'] + "followuser/" : g_rgProfileData['url'] + "unfollowuser/";
	$J.ajax( { url: url,
		data: { sessionid: g_sessionID },
		type: 'POST',
		dataType: 'json'
	} ).done( function( data ) {
		fnOnSuccess( bFollowing );
	}).fail( function( data ) {
		ShowAlertDialog( '', data.results ? data.results : 'Error processing your request. Please try again.' );
	});
}


function ShowFriendSelect( title, fnOnSelect )
{
	var Modal = ShowAlertDialog( title, '<div class="group_invite_throbber"><img src="http://community.edgecast.steamstatic.com/public/images/login/throbber.gif"></div>', 'Cancel' );
	var $ListElement = $J('<div/>', {'class': 'player_list_ctn'} );
	var $Buttons = Modal.GetContent().find('.newmodal_buttons').detach();

	Modal.GetContent().css( 'min-width', 268 );

	var rgParams = {type: 'friends'};

	$J.get( 'http://steamcommunity.com/actions/PlayerList/', rgParams, function( html ) {

		$ListElement.html( html );

		$ListElement.find( 'a' ).remove();
		$ListElement.find( '[data-miniprofile]').each( function() {
			var $El = $J(this);
			$El.click( function() {  Modal.Dismiss(); fnOnSelect( $El.data('miniprofile') ); } );
		} );

		var $Content = Modal.GetContent().find( '.newmodal_content');
		$Content.html(''); // erase the throbber
		$Content.append( $ListElement );
		$Content.append( $Buttons );

		Modal.AdjustSizing();
	});
}

function StartTradeOffer( unAccountID, rgParams )
{
	var params = rgParams || {};
	params['partner'] = unAccountID;
	ShowTradeOffer( 'new', params );
}

function CancelTradeOffer( tradeOfferID )
{
	ShowConfirmDialog(
		'Cancel Trade Offer',
		'Are you sure you want to cancel this trade offer?',
		'Yes',
		'No'
	).done( function() {
		ActOnTradeOffer( tradeOfferID, 'cancel', 'Trade Offer Canceled', 'Cancel Trade Offer' );
	} );
}

function DeclineTradeOffer( tradeOfferID )
{
	ShowConfirmDialog(
		'Decline Trade',
		'Are you sure you want to decline this trade offer?  You can also modify the items and send a counter offer.',
		'Decline Trade',
		null,
		'Make a Counter Offer'
	).done( function( strButton ) {
		if ( strButton == 'OK' )
			ActOnTradeOffer( tradeOfferID, 'decline', 'Trade Declined', 'Decline Trade' );
		else
			ShowTradeOffer( tradeOfferID, {counteroffer: 1} );
	} );
}

function ActOnTradeOffer( tradeOfferID, strAction, strCompletedBanner, strActionDisplayName )
{
	var $TradeOffer = $J('#tradeofferid_' + tradeOfferID);
	$TradeOffer.find( '.tradeoffer_footer_actions').hide();

	return $J.ajax( {
		url: 'https://steamcommunity.com/tradeoffer/' + tradeOfferID + '/' + strAction,
		data: { sessionid: g_sessionID },
		type: 'POST',
		crossDomain: true,
		xhrFields: { withCredentials: true }
	}).done( function( data ) {
		AddTradeOfferBanner( tradeOfferID, strCompletedBanner, false );

		RefreshNotificationArea();
	}).fail( function() {
		ShowAlertDialog( strActionDisplayName, 'There was an error modifying this trade offer.  Please try again later.' );
		$TradeOffer.find( '.tradeoffer_footer_actions').show();
	});
}

function AddTradeOfferBanner( tradeOfferID, strCompletedBanner, bAccepted )
{
	var $TradeOffer = $J('#tradeofferid_' + tradeOfferID);
	$TradeOffer.find( '.tradeoffer_footer_actions').hide();
	$TradeOffer.find( '.link_overlay' ).hide();
	$TradeOffer.find( '.tradeoffer_items_ctn').removeClass( 'active' ).addClass( 'inactive' );

	var $Banner = $J('<div/>', {'class': 'tradeoffer_items_banner' } );
	if ( bAccepted )
		$Banner.addClass( 'accepted' );

	$Banner.text( strCompletedBanner );
	$TradeOffer.find( '.tradeoffer_items_rule').replaceWith( $Banner );
}



var g_elActiveSticker = false;
var g_elStickerContainer = null;
var g_rgDragState = false;
var g_nBaseScaleFactor = 1.0;

var CStickerManager = function( elContainer, bEditMode ){
	this.unWidthActual = 940;
	this.fScaleFactor =  this.unWidthActual / 2100; // Sprite scale
	this.elContainer = elContainer;
	this.rgOwnedStickers = [];
	this.bEditMode = bEditMode || false;
	this.rgNewStickersCount = {};

	if( this.bEditMode )
		this.ShowEditHandles();


	this.rgStickerDefinitions = g_rgStickerDefs;

	// Build some maps
	for( var key in this.rgStickerDefinitions )
	{
		this.rgStickerToIdMap.push( key );
		if( this.rgSceneToIdMap.indexOf( this.rgStickerDefinitions[key].texture ) === -1 )
			this.rgSceneToIdMap.push(this.rgStickerDefinitions[key].texture);

	}

	// Make horrible assumptions about filenames
	for( var i=0; i<this.rgSceneToIdMap.length; i++ )
	{

		CStickerManager.prototype.rgStickerTextures[this.rgSceneToIdMap[i]] = 'http://community.edgecast.steamstatic.com/public/images/promo/summer2017/stickers/'+this.rgSceneToIdMap[i]+'_sprites.png?v=22';
		CStickerManager.prototype.rgBackgroundTextures[this.rgSceneToIdMap[i]] = 'http://community.edgecast.steamstatic.com/public/images/promo/summer2017/stickers/'+this.rgSceneToIdMap[i]+'.jpg?v=22';
	}


	window.addEventListener('resize', this.HandleResize.bind(this));
	this.HandleResize();

}

CStickerManager.prototype.HandleResize = function() {
	// BUCKLE UP
	var fScaleFactor = this.elContainer.parentNode.clientWidth / this.unWidthActual;

	this.elContainer.style.transform = "scale( "+fScaleFactor+", "+fScaleFactor+" )";

	this.fLocalScale = fScaleFactor;

	this.elContainer.style.width = this.unWidthActual + "px";

	var rgBackgrounds = this.elContainer.getElementsByClassName('sticker_background');
	rgBackgrounds[0].style.width = this.unWidthActual + "px";

	// Now do the logo animation

	if ( document.getElementById('logo_anim') )
	{
		document.getElementById('logo_anim').style.transform = "scale( "+fScaleFactor+", "+fScaleFactor+" )";
	}
}

CStickerManager.prototype.rgStickerTextures = {

}

CStickerManager.prototype.rgBackgroundTextures = {

}

CStickerManager.prototype.rgStickerToIdMap = [

];

CStickerManager.prototype.rgSceneToIdMap = [

];

CStickerManager.prototype.rgSceneData = {

};

CStickerManager.prototype.rgStickerDefinitions = {
};


CStickerManager.prototype.RegisterSprites = function(strTexture, strMap, strPlacementMap)
{
	return;
	var rgLines = strMap.split("\n");
	for( var i=0; i<rgLines.length; i++ )
	{
		var rgv = rgLines[i].trim().split(',');
		if( rgv.length != 5 )
			continue;

		this.rgStickerDefinitions[rgv[0]] = {
			texture: strTexture,
			name: rgv[0],
			x: rgv[1],
			y: rgv[2],
			w: rgv[3],
			h: rgv[4]
		}
	}

	var rgLines = strPlacementMap.split("\n");
	for( var i=0; i<rgLines.length; i++ )
	{
		var rgv = rgLines[i].trim().split(',');
		if( rgv.length != 3 && rgv.length != 4 )
			continue;

		this.rgStickerDefinitions[rgv[0]].dx = rgv[1];
		this.rgStickerDefinitions[rgv[0]].dy = rgv[2];
		this.rgStickerDefinitions[rgv[0]].dz = rgv[3] || false;


	}
}

CStickerManager.prototype.AddSticker = function( nStickerId )
{
	// Do we have this sticker in the scene already??
	if( this.BSceneHasSticker( nStickerId ) )
		return;

	var rgData = this.GetSceneData();
	if( rgData.length > 50 )
	{
		ShowAlertDialog("Too many stickers!", "Whoa there! You're trying to put more than 50 stickers on this page. If you want to add more, you'll need to peel a few off first.");
		return;
	}

	var sticker = this.rgStickerDefinitions[nStickerId];
	if( sticker.texture == this.strScene )
	{
		this.CreateSticker( nStickerId,
			sticker.dx * this.fScaleFactor,
			sticker.dy * this.fScaleFactor,
			1.0,
			1.0,
			0,
			sticker.z
		);
	}
	else
		this.CreateSticker( nStickerId, 10, 10, 1.0, 1.0, 0 );

	if( !this.BSceneUnlocked(this.strScene) && this.BSceneCanBeUnlocked( this.strScene ) )
	{
		this.UnlockScene( this.strScene );
	}
}

//CStickerManager.prototype.Set

CStickerManager.prototype.PopulateStickerList = function()
{
	// Sticker list
	var unMaxWidth = 140; // @todo don't hard code this
	var unMaxHeight = 100; // @todo don't hard code this either

	var elTarget = document.getElementById('sticker_selector');

	if( !elTarget )
		return;
	while( elTarget.firstChild )
		elTarget.removeChild( elTarget.firstChild );

	// Do we have a sticker pack? If so show that first
	if( this.unStickerPacks > 0 )
	{
		var elPack = document.createElement('div');
		elPack.classList.add('sticker_item');
		var elImage = document.createElement('img');
		elImage.src = "http://community.edgecast.steamstatic.com/public/images/promo/summer2017/stickers_group.png";

		elPack.addEventListener('click', this.OpenPack.bind(this));

		elPack.appendChild(elImage);
		elTarget.appendChild(elPack);
	}


	for(var key in this.rgStickerDefinitions )
	{


		var stickerDef = this.rgStickerDefinitions[key];


		if( !this.BSceneUnlocked( this.strScene ) && stickerDef.texture != this.strScene )
			continue;

		var elSticker = this.CreateScaledSticker( key, unMaxWidth, unMaxHeight, !this.BOwnsSticker( key ) );



		if( this.BOwnsSticker( key ) )
			elSticker.addEventListener('click', this.AddSticker.bind(this, key ) );

		elTarget.appendChild(elSticker);
	}

}

CStickerManager.prototype.CreateScaledSticker = function( key, unMaxWidth, unMaxHeight, bFaded )
{
	var elImage = document.createElement('div');
	var stickerDef = this.rgStickerDefinitions[key];
	var texture = this.rgStickerTextures[ stickerDef.texture ];


	var elSticker = document.createElement('div');
	elSticker.classList.add('sticker_item');

	elImage.style.width = stickerDef.w + "px";
	elImage.style.height = stickerDef.h + "px";

	if( !bFaded  )
	{
		elImage.style.background = "url('"+texture+"') no-repeat -"+stickerDef.x+"px -"+stickerDef.y+"px";
	} else {
		elImage.style.webkitMask = "url('"+texture+"') no-repeat -"+stickerDef.x+"px -"+stickerDef.y+"px";// no-repeat -"+stickerDef.x+"px -"+stickerDef.y+"px";
		elImage.style.mask = "url('"+texture+"') no-repeat -"+stickerDef.x+"px -"+stickerDef.y+"px";// no-repeat -"+stickerDef.x+"px -"+stickerDef.y+"px";

		elImage.style.backgroundColor = '#9E9E9E';
	}



	var fScale = 1.0;

	if( stickerDef.w > unMaxWidth )
		fScale = unMaxWidth / stickerDef.w;

	if( stickerDef.h > unMaxHeight && unMaxHeight / stickerDef.h < fScale )
		fScale = unMaxHeight / stickerDef.h;


	elImage.style.transform = "scale( "+fScale+", "+fScale+" )";

	elSticker.appendChild( elImage );

	if( this.BOwnsSticker( key ) )
	{
		elSticker.addEventListener ( 'click', this.AddSticker.bind ( this, key ) );
		elSticker.draggable = true;
		elSticker.addEventListener ( 'dragstart', this.DragStart.bind ( this, key ) );
	}

	return elSticker;
}

CStickerManager.prototype.DragStart = function( key, event )
{

	event.dataTransfer.setData("key", key);
	event.dataTransfer.dropEffect = "copy";
	console.log(event);

}
CStickerManager.prototype.PopulateSelectors = function( )
{

	// Scene list
	var elTarget = document.getElementById('scene_selector');
	if( !elTarget )
		return;

	while( elTarget.firstChild )
		elTarget.removeChild( elTarget.firstChild );

	for( var key in this.rgBackgroundTextures )
	{

		var elContainer = document.createElement('div');
		var elImage = document.createElement('img');
		var texture = this.rgBackgroundTextures[ key ];

		elImage.src = texture;
		elContainer.classList.add('item');
		elContainer.id = key + "_select_icon";

		var nSceneId = this.rgSceneToIdMap.indexOf(key);

		elImage.addEventListener('click', this.SetScene.bind(this, nSceneId ) );

		// Text counts
		var rgCounts = this.GetStickerCounts( key );
		var elText = document.createElement('div');
		elText.textContent = "%1$s of %2$s stickers".replace(/%1\$s/,rgCounts[0]).replace(/%2\$s/,rgCounts[1])

		elContainer.appendChild(elImage);
		elContainer.appendChild(elText);


		// New counts
		var nNewStickers = this.rgNewStickersCount[key];
		if( nNewStickers )
		{
			var elNew = document.createElement('div');
			elNew.classList.add('new');
			elNew.textContent = nNewStickers;

			elContainer.appendChild(elNew);
		}

		if( this.rgOwnership.scenes[nSceneId] )
		{
			var elNew = document.createElement('div');
			elNew.classList.add('new');
			elNew.classList.add('unlocked');
			elNew.textContent = '✔';

			elContainer.appendChild(elNew);
		}


		if( nNewStickers )
			elTarget.insertBefore(elContainer, elTarget.firstChild);
		else
			elTarget.appendChild(elContainer);
	}

}

CStickerManager.prototype.GetStickerCounts = function( strScene )
{
	var unStickersTotal = 0;
	var unStickersOwned= 0;

	for( var key in this.rgStickerDefinitions )
	{
		var sticker = this.rgStickerDefinitions[ key ];
		if ( sticker.texture == strScene )
		{
			unStickersTotal++;
			if( this.BOwnsSticker( key ) )
				unStickersOwned++;
		}
	}
	return [ unStickersOwned, unStickersTotal ];
}

CStickerManager.prototype.BOwnsSticker = function( strStickerID )
{

	var nStickerId = this.rgStickerToIdMap.indexOf( strStickerID );
	return this.rgOwnership.stickers[ nStickerId ];
};

CStickerManager.prototype.BSceneUnlocked = function( strScene )
{
	var nSceneId = this.rgSceneToIdMap.indexOf(strScene);
	return this.rgOwnership.scenes[nSceneId];
}

CStickerManager.prototype.BSceneCanBeUnlocked = function( strScene )
{
	var rgSceneData = this.GetSceneData();

	for( var key in this.rgStickerDefinitions )
	{
		var sticker = this.rgStickerDefinitions[ key ];

		if ( sticker.texture == strScene )
		{
			var bFound = false;
			for( var i=0; i<rgSceneData.length; i++ )
			{
				if( rgSceneData[i].id == key )
				{
					bFound = true;
					break;
				}
			}
			if(!bFound)
				return false;
		}
	}
	return true;
}

CStickerManager.prototype.ResetScene = function()
{
	var rgStickers = this.elContainer.getElementsByClassName('sticker');
	for( var i=rgStickers.length - 1; i >= 0; i-- )
	{
		this.elContainer.removeChild( rgStickers[i] );
	}
}

CStickerManager.prototype.GetDefaultScene = function( strScene )
{
	var rgScene = [];

	for( var key in this.rgStickerDefinitions )
	{
		var sticker = this.rgStickerDefinitions[key];
		if( sticker.texture == strScene )
		{
			rgScene.push({
				id: key,
				x: sticker.dx * this.fScaleFactor,
				y: sticker.dy * this.fScaleFactor,
				sx: 1.0,
				sy: 1.0,
				r: 0,
				z: sticker.z
			});
		}
	}

	return rgScene;
}

CStickerManager.prototype.PreloadScene = function()
{
	// pass
}

CStickerManager.prototype.CreateSticker = function(id, x, y, sx, sy, r, z)
{
	var elSticker = document.createElement('div');
	var stickerDef = this.rgStickerDefinitions[id];
	var texture = this.rgStickerTextures[ stickerDef.texture ];

	elSticker.sticker = {
		id: id,
		x: x,
		y: y,
		sx: sx,
		sy: sy,
		r: r,
		z: z
	};

	elSticker.style.width = stickerDef.w + "px";
	elSticker.style.height = stickerDef.h + "px";
	elSticker.style.background = "url('"+texture+"') no-repeat -"+stickerDef.x+"px -"+stickerDef.y+"px";

	this.elContainer.appendChild(elSticker);

	//elSticker.addEventListener('click',  );
	var _this = this;
	elSticker.addEventListener('mousedown', function( event ){
		_this.SetStickerActive( elSticker );
		_this.StickerDragStart('x', 'y', false, event );
	});

	elSticker.addEventListener('touchstart', function( event ){
		_this.SetStickerActive( elSticker );
		_this.StickerDragStart('x', 'y', false, event );
	});

	this.UpdateStickerState( elSticker );

	elSticker.classList.add("sticker");




}

CStickerManager.prototype.UpdateStickerState = function( elSticker )
{
	elSticker.style.transform = "rotate("+elSticker.sticker.r+"deg) scale("+(elSticker.sticker.sx*this.fScaleFactor)+", "+(elSticker.sticker.sy*this.fScaleFactor)+")";

	var rect = elSticker.getBoundingClientRect();

	elSticker.style.left = elSticker.sticker.x+"px";
	elSticker.style.top = elSticker.sticker.y+"px";

	if( elSticker.sticker.z )
		elSticker.style.zIndex = elSticker.sticker.z;


}

CStickerManager.prototype.SetScene = function( nSceneId )
{

	// Save off old scene if we were on one
	if( this.strScene )
	{

		var nOldSceneId = this.rgSceneToIdMap.indexOf( this.strScene );
		this.rgSceneData[nOldSceneId] = this.GetSceneData();
	}

	this.strScene = this.rgSceneToIdMap[ nSceneId ];

	var rgBackgrounds = this.elContainer.getElementsByClassName('sticker_background');
	rgBackgrounds[0].src =this.rgBackgroundTextures[this.strScene];

	this.Render( this.rgSceneData[ nSceneId ] );

	// Update handles
	var rgMatches = document.querySelectorAll('.background_selection_container .item');

	for( var i=0; i < rgMatches.length; i++)
	{
		rgMatches[i].classList.remove('selected');
	}

	var elTarget  = document.getElementById(this.strScene  + "_select_icon");
	if( elTarget )
		elTarget.classList.add('selected');

	this.PopulateStickerList();

	if( this.bEditMode )
	{
		if ( !this.BSceneUnlocked ( this.strScene ) )
		{
			document.getElementById ( 'r_handle' ).style.display = "none";
			document.getElementById ( 's_handle' ).style.display = "none";
			document.getElementById ( 'feature_on_profile' ).style.display = "none";

		}
		else
		{
			document.getElementById ( 'r_handle' ).style.display = "block";
			document.getElementById ( 's_handle' ).style.display = "block";
			document.getElementById ( 'feature_on_profile' ).style.display = "inline-block";
		}
	}

};

CStickerManager.prototype.Render = function( rgSceneData )
{
	this.ResetScene();


	for( var i=0; i<rgSceneData.length; i++)
	{
		var sticker = rgSceneData[i];
		this.CreateSticker( sticker.id, sticker.x, sticker.y, sticker.sx, sticker.sy, sticker.r, sticker.z );
	}

	this.DeactivateSticker();
}

CStickerManager.prototype.MoveDot = function( dot, x, y )
{
	var dot = document.getElementById(dot);
	dot.style.top = y + "px";
	dot.style.left = x + "px";
}


CStickerManager.prototype.SetStickerActive = function( sticker )
{

	this.DeactivateSticker();

	this.elActiveSticker = sticker;
	sticker.classList.add('active');
	var elEditBox = document.getElementById('edit_box');
	elEditBox.classList.add('active');

	this.UpdateStickerHandles();

}

// Deselect any active sticker
CStickerManager.prototype.DeactivateSticker = function( )
{
	// Deactivate other sticker
	if( this.elActiveSticker )
	{
		this.elActiveSticker.classList.remove('active');
		var elEditBox = document.getElementById('edit_box');
		elEditBox.classList.remove('active');
	}
}

CStickerManager.prototype.UpdateStickerHandles = function()
{
	var elEditBox = document.getElementById('edit_box'); // @todo chrisk switch to class of elContainer if we ever need to have two editable boxes on one page

	var rect = this.elActiveSticker.getBoundingClientRect();
	var parentRect = this.elContainer.getBoundingClientRect();


	elEditBox.style.left =  1/this.fLocalScale * ( rect.left -  parentRect.left )  + "px";
	elEditBox.style.top = 1/this.fLocalScale * ( rect.top -  parentRect.top ) + "px";
	elEditBox.style.width = 1/this.fLocalScale * rect.width+ "px";
	elEditBox.style.height = 1/this.fLocalScale * rect.height+ "px";
}


CStickerManager.prototype.ShowEditHandles = function()
{

	document.getElementById('d_handle').addEventListener('mouseup', this.StickerDelete.bind(this ) );
	document.getElementById('s_handle').addEventListener('mousedown', this.StickerDragStart.bind(this, 'sx', 'sy', false ) );
	document.getElementById('r_handle').addEventListener('mousedown', this.StickerDragStart.bind(this, 'r', 'r', false) );

	this.elContainer.addEventListener('mousemove', this.StickerDragMove.bind(this) );
	this.elContainer.addEventListener('mouseup', this.StickerDragStop.bind(this) );

	// phones
	document.getElementById('d_handle').addEventListener('touchend', this.StickerDelete.bind(this  ) );
	document.getElementById('s_handle').addEventListener('touchstart', this.StickerDragStart.bind(this, 'sx', 'sy', false ) );
	document.getElementById('r_handle').addEventListener('touchstart', this.StickerDragStart.bind(this, 'r', 'r', false) );

	this.elContainer.addEventListener('touchmove', this.StickerDragMove.bind(this) );

	this.elContainer.addEventListener('touchend', this.StickerDragStop.bind(this) );
	this.elContainer.addEventListener('touchcancel', this.StickerDragStop.bind(this) );

	this.elContainer.addEventListener('drop', this.StickerDragDrop.bind(this) );
	this.elContainer.addEventListener('dragover', this.StickerDrag.bind(this) );

}

CStickerManager.prototype.StickerDragDrop = function( event )
{
	if( event.dataTransfer.getData('key') )
		this.AddSticker( event.dataTransfer.getData('key') );


}

CStickerManager.prototype.StickerDrag = function( event )
{

	event.preventDefault();
}

CStickerManager.prototype.StickerDelete = function(  )
{
	this.elActiveSticker.parentNode.removeChild(this.elActiveSticker);
	this.DeactivateSticker();
}

CStickerManager.prototype.StickerDragStart = function( propertyX, propertyY, propertyR, event )
{
	event.target.parentNode.classList.add('active');

	this.rgDragState = {
		x: event.screenX || event.touches[0].screenX,
		y: event.screenY || event.touches[0].screenY,
		property_x: propertyX,
		property_y: propertyY,
		property_r: propertyR
	};

	event.preventDefault();
};

CStickerManager.prototype.StickerDragStop = function( )
{
	this.rgDragState = false;
	event.preventDefault();

	var rgElements = document.querySelectorAll('#edit_box > div');

	for( var i=0; i<rgElements.length; i++)
		rgElements[i].classList.remove('active');


}



CStickerManager.prototype.StickerDragMove = function( event )
{
	//console.log(event);
	if ( !this.rgDragState )
		return;

	if( !this.BSceneUnlocked( this.strScene ) )
		return;
	var nTouchX = event.screenX || event.touches[0].screenX;
	var nTouchY = event.screenY || event.touches[0].screenY;

	var nTouchPageX = event.pageX || event.touches[0].pageX;
	var nTouchPageY = event.pageY || event.touches[0].pageY;

	if( this.rgDragState.property_x )
	{
		var xdelta  = nTouchX - this.rgDragState.x;

		if( this.rgDragState.property_x == "sx")
		{

			this.elActiveSticker.sticker.sx += xdelta / this.rgStickerDefinitions[ this.elActiveSticker.sticker.id ].w;

		}
		else
		{
			this.elActiveSticker.sticker[this.rgDragState.property_x] += xdelta;
		}


	}

	if( this.rgDragState.property_y )
	{
		var ydelta  = nTouchY - this.rgDragState.y;

		if( this.rgDragState.property_y == "sy")
		{
			this.elActiveSticker.sticker.sy += ydelta / this.rgStickerDefinitions[ this.elActiveSticker.sticker.id ].h;

		}
		else
			this.elActiveSticker.sticker[this.rgDragState.property_y] += ydelta;

	}

	// Balance sx/sy
	this.elActiveSticker.sticker.sx = this.elActiveSticker.sticker.sy;


	if( this.rgDragState.property_r )
	{


		var rect = this.elActiveSticker.getBoundingClientRect();
		var parentRect = this.elActiveSticker.getBoundingClientRect();

		var x = rect.left - parentRect.left + rect.width / 2;
		var y = rect.top - parentRect.top + rect.height / 2;


		var mousex = nTouchPageX - parentRect.left;
		var mousey = nTouchPageY - parentRect.top ;



		var angle = Math.atan2( mousey - y, mousex - x ) * 180 / Math.PI;


		this.elActiveSticker.sticker[this.rgDragState.property_r] = angle;

	}


	this.rgDragState.x = nTouchX;
	this.rgDragState.y = nTouchY;

	this.UpdateStickerState( this.elActiveSticker );
	this.UpdateStickerHandles();

	event.preventDefault();

}

CStickerManager.prototype.SetOwnedStickers = function( rgOwnership )
{
	this.rgOwnership = rgOwnership;
	this.unStickerPacks = rgOwnership.stickerpacks;



	this.PopulateSelectors();
	this.PopulateStickerList();
};

CStickerManager.prototype.SetSceneData = function( rgStuff )
{
	for ( var i = 0; i < this.rgSceneToIdMap.length; i++ )
	{
		this.rgSceneData[i] = rgStuff[i] || [];
	}

}

CStickerManager.prototype.BSceneHasSticker = function( strStickerId )
{
	var rgData = this.GetSceneData();
	for ( var i=0; i<rgData.length; i++ )
		if( rgData[i].id == strStickerId )
			return true;

	return false;
}


CStickerManager.prototype.GetSceneData = function()
{
	// pass
	var rgScene = [];
	var rgStickers = document.getElementsByClassName('sticker');

	if( rgStickers )
	{

		for ( var i = 0; i < rgStickers.length; i++ )
		{
			rgScene.push ( rgStickers[ i ].sticker );
		}
	}

	return rgScene;
};

CStickerManager.prototype.SaveScene = function( bFeature, bSilent )
{
	var rgRequest = {
		scene_data: this.GetSceneData(),
		sceneid: this.rgSceneToIdMap.indexOf( this.strScene ),
		sessionid: g_sessionID,
		active: bFeature ? 1 : 0
	};

	$J.ajax({
		url: g_strProfileURL + '/stickerssave/',
		data: rgRequest,
		method: 'POST'

	}).done(function() {

		if( !bSilent )
			ShowAlertDialog( "Changes Saved", "Your sticker progress has been saved." )

		console.log("SAVED");
	});
};

CStickerManager.prototype.UnlockScene = function(  )
{
	this.SaveScene(false, true);

	var nSceneId = this.rgSceneToIdMap.indexOf(this.strScene);

	var _this = this;

	$J.ajax({
		url: g_strProfileURL + '/stickerscomplete/',
		method: 'POST',
		data: {
			scene: nSceneId
		}


	}).done(function( data )
	{
		if( data.success == 1 )
		{
			ShowAlertDialog( "Scene unlocked!", "You can now move, rotate, and scale stickers on this scene, as well as add stickers from other scenes and feature it on your profile!" );
			_this.rgOwnership.scenes[ nSceneId ] = 1;
			_this.PopulateStickerList();
		}
	});
}


CStickerManager.prototype.OpenPack = function()
{
	var _this = this;

	$J.ajax({
		url: g_strProfileURL + '/stickersopen/',
		method: 'POST'

	}).done(function( data ) {

		if( data && data.success == 1 && data.stickers.length > 0 )
		{
			var elContainer = document.createElement ( 'div' );
			elContainer.classList.add ( 'openpack_container' );

			var elDesc = document.createElement ( 'p' );
			elDesc.textContent = "%1$s new stickers have been added to your collection.".
			replace ( /%1\$s/, data.stickers.length );

			elContainer.appendChild ( elDesc );


			var elStickerContainer = document.createElement ( 'div' );
			elStickerContainer.classList.add ( 'sticker_container' );


			while ( data.stickers.length )
			{

				var nStickerId = data.stickers.pop ();

				var elSticker = _this.CreateScaledSticker ( _this.rgStickerToIdMap[ nStickerId ], 140, 100, false );
				elStickerContainer.appendChild ( elSticker );
				_this.rgOwnership.stickers[ nStickerId ] = 1;

				var strStickerKey = _this.rgStickerToIdMap[ nStickerId ];
				var rgStickerDef = _this.rgStickerDefinitions[ strStickerKey ];
				var strScene = rgStickerDef.texture;

				if( _this.rgNewStickersCount[strScene] )
					_this.rgNewStickersCount[strScene]++;
				else
					_this.rgNewStickersCount[strScene] = 1;


			}

			elContainer.appendChild ( elStickerContainer );

			// Did we unlock any scenes?
			var strUnlockTexture = false;
			for ( var i = 0; i < data.stickers.length; i++ )
			{
				var stickerDef = _this.rgStickerDefinitions[ _this.rgStickerToIdMap[ i ] ];
				var strScene = stickerDef.texture;
				if ( _this.BSceneUnlocked ( strScene ) )
				{

					strUnlockTexture = _this.rgBackgroundTextures[ strScene ];
				}

			}

			if ( strUnlockTexture )
			{
				var elUnlockContainer = document.createElement ( 'div' );
				elUnlockContainer.classList.add ( 'unlock_container' );

				var elUnlockTitle = document.createElement ( 'h2' );
				elUnlockTitle.textContent = "Scene unlocked!";

				var elUnlockSceneImg = document.createElement ( 'img' );
				elUnlockSceneImg.src = strUnlockTexture;

				var elUnlockDesc = document.createElement ( 'p' );
				elUnlockDesc.textContent = "You can now move, rotate, and scale stickers on this scene, as well as add stickers from other scenes and feature it on your profile!";

				elUnlockContainer.appendChild ( elUnlockSceneImg );
				elUnlockContainer.appendChild ( elUnlockTitle );
				elUnlockContainer.appendChild ( elUnlockDesc );
				elContainer.appendChild ( elUnlockContainer );
			}

			_this.unStickerPacks = data.stickerpacks;

			var Modal = ShowAlertDialog ( "New stickers have been added to your collection!", elContainer );
		}
		_this.PopulateStickerList();
		_this.PopulateSelectors();

		var elTarget  = document.getElementById(_this.strScene  + "_select_icon");
		if( elTarget )
			elTarget.classList.add('selected');




	});
}

// =====================================================================================================================

var CTaskManager = function(){}

CTaskManager.prototype.rgTaskList = [
	//k_ESummerSaleTaskUseDiscoveryQueue = 0;
	{
		name: "Explore your Discovery Queue",
		desc: "Visit your <a href=\"http:\/\/store.steampowered.com\/explore\">personal Discovery Queue<\/a> and click through to the end. You can complete this quest once per day."	},
	//k_ESummerSaleTaskPlayAGame = 1;
	{
		name: "Play a game from your library",
		desc: "Just play any game from your Steam library! Something new, or something from your backlog..."	},
	//k_ESummerSaleTaskViewFriendActivity = 2;
	{
		name: "View your Friend Activity page",
		desc: "See what's going on with your friends on Steam at your <a href=\"http:\/\/steamcommunity.com\/my\/home\">Friend Activity<\/a> page."	},
	//k_ESummerSaleTaskAddToWishlist = 3;
	{
		name: "Add to your wishlist",
		desc: "Find a game you are interested in, and add it to your <a href=\"http:\/\/steamcommunity.com\/my\/wishlist\">Wishlist<\/a>."	},
	//k_ESummerSaleTaskReviewStorePreferences = 4;
	{
		name: "Review your Preferences",
		desc: "You can help the Steam store show you the best stuff by making sure your <a href=\"http:\/\/store.steampowered.com\/account\/preferences\/\">Store Preferences<\/a> match your interests."	},
	//k_ESummerSaleTaskEarnAchievement = 5;
	{
		name: "Earn an Achievement",
		desc: "Play any Steam game in your library, and earn an Achievement. You can check your Achievement progress for any game you own <a href=\"http:\/\/steamcommunity.com\/my\/games\">on your Games page<\/a>."	},
	//k_ESummerSaleTaskVisitBroadcastPage = 6;
	{
		name: "Visit the Broadcasts page",
		desc: "Take a look at the <a href=\"http:\/\/steamcommunity.com?subsection=broadcasts\">Broadcasts<\/a> currently running on the Community."	},
	//k_ESummerSaleTaskMarkReviewHelpful = 7;
	{
		name: "Mark a Review as Helpful ... or not",
		desc: "Did a Steam community review help you make a decision about a game? Mark any review as Helpful, Not Helpful, or Funny."	},
	//k_ESummerSaleTaskFollowCurator = 8;
	{
		name: "Follow a Curator",
		desc: "Look through the <a href=\"http:\/\/store.steampowered.com\/curators\">Steam Curators<\/a> and follow someone that will help you find the best games on Steam."	},
	//k_ESummerSaleTaskViewAProfile = 9;
	{
		name: "View a Profile",
		desc: "Take a look at what <a href=\"http:\/\/steamcommunity.com\/my\/friends\">your friends<\/a> have showcased on their Steam Community Profile."	},
	//k_ESummerSaleTaskViewATagPage = 10;
	{
		name: "Explore popular tags",
		desc: "Choose something interesting from <a href=\"http:\/\/store.steampowered.com\/tag\/browse\">the recommended tags for you<\/a>. Try a few!"	},
	//k_ESummerSaleTaskMarkNotInterested = 11;
	{
		name: "Mark something Not Interested",
		desc: "Somewhere on the store, you'll find a game that isn't for you. Click the Not Interested button - don't worry, it only affects that game."	},
	//k_ESummerSaleTaskViewVideosPage = 12;
	{
		name: "Browse the Videos on Steam",
		desc: "Visit the <a href=\"http:\/\/store.steampowered.com\/videos\">Video Hub<\/a> on Steam."	},
	//k_ESummerSaleTaskUploadAScreenshot = 13;
	{
		name: "Visit your screenshot library",
		desc: "You can take a screenshot in-game (default hotkey is F12) and upload it to Steam; go <a href=\"http:\/\/steamcommunity.com\/my\/screenshots\">visit your uploaded Screenshots<\/a> on the Steam Community."	},
	//k_ESummerSaleTaskPersonalizeProfile = 14;
	{
		name: "Personalize your Steam Community Profile",
		desc: "There are a lot of ways you can customize <a href=\"http:\/\/steamcommunity.com\/my\/profile\">your profile<\/a> - click the attractive Edit Profile button, and personalize!"	},
	//k_ESummerSaleTaskPersonalizeDiscoveryQueue = 15;
	{
		name: "Customize your Discovery Queue",
		desc: "Make sure your personalized Discovery Queue is personal \u2013 your <a href=\"http:\/\/store.steampowered.com\/account\/preferences?discoveryqueue=1\">Discovery Queue settings<\/a> should match what you want to see on Steam."	},
];

CTaskManager.prototype.RenderTaskList = function( rgProgress )
{
	// First pass, find tasks we need to do still

	var elTaskContainer = document.getElementById('tasks_remaining_container');
	var elTaskCompleteContainer = document.getElementById('tasks_completed_container');

	var rgTaskIdsShown = {};

	var nTasksToDo = 0;

	for( var i in rgProgress.tasks_remaining )
	{
		if( rgProgress.tasks_remaining[i] > 0 )
		{
			var rgTaskInfo = this.rgTaskList[i];
			rgTaskIdsShown[ i ] = 1;

			//if( !rgTaskInfo ) // ???
			//	continue;

			var elTask = document.createElement('div');
			elTask.classList.add('task');

			var elTaskName = document.createElement('h2');
			elTaskName.innerHTML = rgTaskInfo.name;

			var elTaskDesc = document.createElement('p');
			elTaskDesc.innerHTML = rgTaskInfo.desc;

			elTask.appendChild( elTaskName );
			elTask.appendChild( elTaskDesc );

			elTaskContainer.appendChild( elTask );

			nTasksToDo++;

		}
	}

	if( nTasksToDo == 0 )
	{
		var elT = document.getElementById('tasks_none');
		if( elT )
			elT.style.display = 'inline';
	} else if( nTasksToDo == 1 )
	{
		var elT = document.getElementById('tasks_one');
		if( elT )
			elT.style.display = 'inline';
	} else
	{
		var elT = document.getElementById('tasks_many');
		if( elT )
		{
			elT.style.display = 'inline';
			var elTC = document.getElementById('task_count');
			elTC.textContent = nTasksToDo;
		}
	}

	for(var i in rgProgress.tasks_limits )
	{
		if( rgProgress.tasks_limits[i] > 0 && !rgTaskIdsShown[i] )
		{
			var rgTaskInfo = this.rgTaskList[i];

			if( !rgTaskInfo ) // ???
				continue;

			var elTask = document.createElement('div');
			elTask.classList.add('task');

			elTask.innerHTML = '✔ ' + rgTaskInfo.name;



			elTaskCompleteContainer.appendChild( elTask );

		}
	}
}



var gItems = Array();

function BanItem( id )
{
	var item = gItems[id];
	var appid = item['consumer_appid'];
	var title = item['title'];
	var options = {
		method: 'post',
		postBody: 'id=' + id + '&appid=' + appid + '&sessionid=' + g_sessionID + '&IsBanned=1',
		onComplete: (function(id){
			return function(transport)
			{
				ShowWithFade( $( 'banned_' + id ) );
				$J( '#item_' + id ).addClass( 'banned' );
			}
		}(id))
	};
	new Ajax.Request(
		'http://steamcommunity.com/sharedfiles/ban',
		options
	);
}

function MarkIncompatible( id )
{
	var item = gItems[id];
	var appid = item['consumer_appid'];
	var title = item['title'];
	var options = {
		method: 'post',
		postBody: 'id=' + id + '&appid=' + appid + '&sessionid=' + g_sessionID + '&incompatible=1',
		onComplete: (function(id){
			return function(transport)
			{
				ShowWithFade( $( 'incompatible_' + id ) );
				$J( '#item_' + id ).addClass( 'incompatible' );
			}
		}(id))
	};
	new Ajax.Request(
		'http://steamcommunity.com/sharedfiles/updateincompatible',
		options
	);
}

function ResetReports( id )
{
	var item = gItems[id];
	var appid = item['consumer_appid'];
	var title = item['title'];
	var options = {
		method: 'post',
		postBody: 'id=' + id + '&appid=' + appid + '&sessionid=' + g_sessionID,
		onComplete: (function(id){
			return function(transport)
			{
				$J( "#ModerationControls_" + id ).html( '<span style="color: green">Reports Cleared!</span>' );
			}
		}(id))
	};
	new Ajax.Request(
		'http://steamcommunity.com/sharedfiles/resetreportedcount',
		options
	);
}

function ViewReports( id )
{
	var item = gItems[id];
	var appid = item['consumer_appid'];
	var title = item['title'];
	$( 'reportsTitle' ).update( 'All Reports for: ' + title );
	$( 'reports' ).update("<div style='width: 100%; text-align: center;'>Loading</div>");
	new Ajax.Updater( "reports", "http://steamcommunity.com/sharedfiles/getreports/?id=" + id + "&appid=" + appid );
	showModal( 'reportsModal', false );
}

function UpdateSelectedItems()
{
	$J( '#NumItemsSelected' ).text( $J( '.reported_item_checkbox:checked').length );

	$J( '.reported_item_checkbox' ).each( function( index, elem ) {
		elem = $J( elem );
		var publishedFileID = elem.data( 'dsPublishedfileid' );
		var parent = $J( "#item_" + publishedFileID );
		if ( elem.prop( 'checked' ) )
		{
			parent.css( 'background-color', 'rgba( 84, 133, 183, 0.4)' );
		}
		else
		{
			parent.css( 'background-color', 'rgba( 0,0,0,.3)' );
		}
	} );
}

function SelectAllItems()
{
	$J( '.reported_item_checkbox' ).prop( 'checked', true );
	UpdateSelectedItems();
}

function DeselectAllItems()
{
	$J( '.reported_item_checkbox' ).prop( 'checked', false );
	UpdateSelectedItems();
}

function ApplyFuncOnSelectedItems( func )
{
	$J( '.reported_item_checkbox' ).each( function( index, elem ) {
		elem = $J( elem );
		if ( elem.prop( 'checked' ) )
		{
			var itemid = elem.data( 'itemid' );
			func( itemid );
		}
	} );
}

function SelectedItems_Ban()
{
	ApplyFuncOnSelectedItems( BanItem );
}

function SelectedItems_MarkIncompatible()
{
	ApplyFuncOnSelectedItems( MarkIncompatible );
}

function SelectedItems_ResetReports()
{
	ApplyFuncOnSelectedItems( ResetReports );
}

function BanReview( id )
{
	UserReview_Moderate_SetBanStatus( id, 1, 'http://steamcommunity.com',
		function( results ) {
			ShowWithFade( $( 'banned_' + id ) );
		},
		'Mass banned from reported content page'
	);
}

function ClearReviewDevFlag( id )
{
	UserReview_ClearDeveloperFlag( id, 'http://steamcommunity.com',
		function( results ) {
			ShowWithFade( $( 'incompatible_' + id ) );
		}
	);
}

function ClearReviewReports( id )
{
	UserReview_ShowClearReportsDialog( id, 'http://steamcommunity.com',
		function( results ) {
			$( 'report_score_' + id ).update( '0' );
		}
	);
}

function ViewReviewReports( id )
{
	UserReview_ShowReportsDialog( id, 'http://steamcommunity.com' );
}

function SelectedReviews_Ban()
{
	ApplyFuncOnSelectedItems( BanReview );
}

function SelectedReviews_ClearReports()
{
	ApplyFuncOnSelectedItems( ClearReviewReports );
}

function SelectedReviews_ClearReviewDevFlag()
{
	ApplyFuncOnSelectedItems( ClearReviewDevFlag );
}

function ResetProfileAndGroupContent( steamID )
{
	new Ajax.Request( 'http://steamcommunity.com/moderation/ajaxgetresetcontentmodal', {
		method: 'post',
		parameters: { steamid : steamID },
		onSuccess: function( jqxhr )
		{
			var results = jqxhr.responseText;

			var $modal = ShowConfirmDialog( "Reset Content", $J( results ), "Reset Content" );
			$modal.AdjustSizing();

			var $content = $modal.GetContent();

			$modal.done( function() {
				new Ajax.Request( 'http://steamcommunity.com/moderation/ajaxresetcontent', {
					method: 'post',
					parameters: $content.find( '#resetcontentform' ).serialize(),
					onSuccess: function( jqxhr2 )
					{
						results = V_ParseJSON( jqxhr2.responseText );
						if ( results.success )
						{
							location.reload();
						}
						else
						{
							ShowAlertDialog( "Reset Content Failed", results.failures.length + ' content types failed to be cleared' );
						}
					}
				} );
			} );
		}
	} );
}
"use strict";

// build our menu on init
jQuery( function($) {
	var mqQueryMenuMode = window.matchMedia ? window.matchMedia("(max-width: 910px)") : {matches: false};

	var $HTML = $J('html');
	window.UseTouchFriendlyMode = function() {
		return $HTML.hasClass( 'responsive' ) && ( mqQueryMenuMode.matches || $HTML.hasClass('touch') );
	};
	window.UseSmallScreenMode = function() {
		return $HTML.hasClass( 'responsive' ) && mqQueryMenuMode.matches;
	};


	// main menu

	var $Menu = $('#responsive_page_menu');
	var $Frame = $('.responsive_page_frame');
	var $ContentCtn = $('.responsive_page_content' );
	var $ContentOverlay = $('.responsive_page_content_overlay');

	var fnResetMenuState = function() {
		$Frame.removeClass( 'mainmenu_active');
		$Frame.removeClass('localmenu_active');
		$J(document.body).removeClass( 'overflow_hidden' );

		$ContentOverlay.off( 'click.ReponsiveMenuDismiss');
	};

	$J(document).on('click.OnClickDismissMenu', '.responsive_OnClickDismissMenu', fnResetMenuState );

	var strLastExpandedSubmenu = WebStorage.GetLocalSession( 'responsiveMenuLastSubmenu' );

	var fnMakeExpandableMenuItem = function( $MenuItem, $Submenu )
	{
		$MenuItem.append( $J('<div/>', {'class': 'chevron' } ) );


		var $SubmenuWrapper = $J('<div/>', {'class': 'menuitem_submenu_wrapper' });
		$MenuItem.after( $SubmenuWrapper.append( $Submenu ) );
		$Submenu.wrap( $('<div/>', {'class': 'inner_borders' } ) );

		// if this was the last used submenu, start with it expanded
		if ( strLastExpandedSubmenu && strLastExpandedSubmenu == $Submenu.data('submenuid') )
		{
			$SubmenuWrapper.css( 'height', $Submenu.height() + 'px' );
			$MenuItem.addClass( 'submenu_active' );
			$SubmenuWrapper.addClass('active');
		}
		else
		{
			$SubmenuWrapper.css( 'height', 0 );
		}

		$Submenu.show();

		$MenuItem.click( function(e) {
			e.preventDefault();
			if ( $SubmenuWrapper.hasClass('active' ) )
			{
				$SubmenuWrapper.removeClass('active' ).css('height',0);
				$MenuItem.removeClass('submenu_active');
				WebStorage.SetLocalSession( 'responsiveMenuLastSubmenu', null );
			}
			else
			{
				$SubmenuWrapper.siblings( '.menuitem_submenu_wrapper.active' ).css('height',0 ).removeClass('active');
				$MenuItem.siblings('.menuitem').removeClass('submenu_active');
				$SubmenuWrapper.css( 'height', $Submenu.height() + 'px' );
				$MenuItem.addClass( 'submenu_active' );
				$SubmenuWrapper.addClass('active');
				WebStorage.SetLocalSession( 'responsiveMenuLastSubmenu', $Submenu.data('submenuid') );
			}
		});
	};

	var fnBuildMenuEvents = function( $Menu, strMenuName, fnFirstTimeInitialization )
	{
		var strActiveClass = strMenuName + '_active';
		var fnDismissMenu = function() {
			$ContentCtn.off( 'click.ReponsiveMenuDismiss');
			$Frame.removeClass(strActiveClass);
			$J(document.body).removeClass('overflow_hidden' );

			window.setTimeout( function() {
				if ( !$Frame.hasClass('mainmenu_active') && !$Frame.hasClass('localmenu_active') )
				{
					fnResetMenuState();
				}
			}, 500 );
		};

		var bInitialized = false;
		var fnActivateMenu = function() {
			if ( !bInitialized )
			{
				fnFirstTimeInitialization && fnFirstTimeInitialization();
				bInitialized = true;
			}

			if ( $Frame.hasClass( strActiveClass ) )
			{
				fnDismissMenu();
			}
			else
			{
				$J(document.body).addClass('overflow_hidden' );
				$Menu.removeClass('secondary_active');
				$Frame.addClass( strActiveClass );
				$ContentOverlay.one( 'click.ResponsiveMenuDismiss', function() {
					fnDismissMenu();
				});
			}
		};

		return { fnActivateMenu: fnActivateMenu, fnDismissMenu: fnDismissMenu };
	};

	var fnInitMainMenu = function() {
		$('.responsive_page_menu' ).find( '.supernav').each( function() {
			var $Element = $(this);
			$Element.attr('href','');
			var strSubmenuSelector = $Element.data('tooltip-content');
			var $Submenu = $Element.parent().find(strSubmenuSelector);
			if ( $Submenu.length )
			{
				fnMakeExpandableMenuItem( $Element, $Submenu );
			}
		});

		var $NotificationItem = $Menu.find( '.notifications_item' );
		var $NotificationSubmenu = $Menu.find('.notification_submenu');
		if ( $NotificationItem.length && $NotificationSubmenu.length )
		{
			fnMakeExpandableMenuItem( $NotificationItem, $NotificationSubmenu );
		}
		Responsive_BuildChangeLanguageOption( $Menu.find( '.change_language_action' ) );
	};

	var MainMenuEvents = null;
	if ( $Menu.length )
	{
		MainMenuEvents = fnBuildMenuEvents( $Menu, 'mainmenu', fnInitMainMenu );


		$('#responsive_menu_logo' ).click( function( e ) {
			MainMenuEvents.fnActivateMenu();
		} );
	}


	// local (page-specific) menu

	var $LocalMenuContent = $('.responsive_local_menu');
	var $LocalMenu = null;
	var LocalMenuEvents = null;
	if ( $LocalMenuContent.length )
	{
		var bLocalMenuEnabed = false;
		var rgMenuContents = [];

		var fnInitLocalMenu = function() {
			if ( rgMenuContents.length )
				return;

			for ( var i = 0; i < $LocalMenuContent.length; i++ )
			{
				var $LocalMenuElement = $($LocalMenuContent[i] ).wrap( $J('<div/>', {'class': 'responsive_local_menu_placeholder' } ) );
				var $LocalMenuWrapper = $($LocalMenuContent[i]).parent();
				rgMenuContents.push( {
					wrapper: $LocalMenuWrapper,
					content: $LocalMenuElement
				});
			}
		};

		$LocalMenu = $J('#responsive_page_local_menu');
		var $Affordance = $J('.responsive_local_menu_tab');

		LocalMenuEvents = fnBuildMenuEvents( $LocalMenu, 'localmenu' );

		$Affordance.click( function( e ) {
			LocalMenuEvents.fnActivateMenu();
		});

		$(window ).on( 'Responsive_SmallScreenModeToggled.ReponsiveLocalMenu', function() {
			var bShouldUseResponsiveMenu = UseSmallScreenMode();
			if ( bLocalMenuEnabed != bShouldUseResponsiveMenu )
			{
				if ( bShouldUseResponsiveMenu )
				{
					$Affordance.addClass( 'active' );
					fnInitLocalMenu();
					$LocalMenu.find('.localmenu_content' ).append( $LocalMenuContent );
				}
				else
				{
					fnResetMenuState();
					$Affordance.removeClass('active');
					for ( var i = 0; i < rgMenuContents.length; i++ )
					{
						rgMenuContents[i].wrapper.append( rgMenuContents[i].content );
					}
				}
				bLocalMenuEnabed = bShouldUseResponsiveMenu;
			}
		} ).trigger( 'Responsive_SmallScreenModeToggled.ReponsiveLocalMenu');
	}

	Responsive_InitMenuSwipes( $, $Menu, $LocalMenu, MainMenuEvents, LocalMenuEvents );

	Responsive_InitFixOnScroll( $ );

	Responsive_InitTouchDetection( $ );

	Responsive_InitTabSelect( $ );

	Responsive_InitResponsiveToggleEvents( $ );

	Responsive_InitJQPlotHooks( $ );
});

function Responsive_InitMenuSwipes( $, $Menu, $LocalMenu, MainMenuEvents, LocalMenuEvents )
{
	if ( !MainMenuEvents && !LocalMenuEvents )
		return;

	var $Frame = $('.responsive_page_frame');
	// set up touch drag events
	var bInMainMenuDrag = false;
	var bInLocalMenuDrag = false;
	var bInDismissMenuDrag = false;
	var bLooksLikeSwipe = false;
	var nDragMenuWidth = 0;

	var nCurDragOffset = 0;
	var nTouchStartPageX = 0;	// page/CSS coordinates because that's how we measure the menu width
	var nTouchStartPageY = 0;

	var fnGetSingleTouch = function(e) {
		var TouchEvent = e.originalEvent;
		var rgTouches = TouchEvent ? TouchEvent.touches : null;
		if ( !rgTouches || rgTouches.length != 1 )
			return null;
		return rgTouches[0];
	};
	var fnCancelDrag = function()
	{
		$Frame.removeClass('in_menu_drag');
		if ( bLooksLikeSwipe )
		{
			var DragMenuEvents = bInMainMenuDrag ? MainMenuEvents : LocalMenuEvents;
			var $DragMenu = bInMainMenuDrag ? $Menu : $LocalMenu;
			$DragMenu.parents('.responsive_page_menu_ctn' ).css( 'left', '' ).css( 'right', '' );
			if ( ( !bInDismissMenuDrag && nCurDragOffset < nDragMenuWidth / 2 ) ||
				( bInDismissMenuDrag && nCurDragOffset > nDragMenuWidth / 2 ) )
			{
				DragMenuEvents.fnDismissMenu();
			}
		}

		bInLocalMenuDrag = bInMainMenuDrag = bLooksLikeSwipe = bInDismissMenuDrag = false;
	};
	$(window ).on('touchstart.ResponsiveMenuActivate', function(e) {
		if ( !UseSmallScreenMode() )
			return;

		var Touch = fnGetSingleTouch(e);
		if ( !Touch )
			return;

		if ( $Frame.hasClass('mainmenu_active') )
		{
			if ( Touch.clientX > $Menu.width() * 0.9 )
			{
				bInMainMenuDrag = true;
				bInDismissMenuDrag = true;
			}
		}
		else if ( $Frame.hasClass('localmenu_active') )
		{
			if ( Touch.clientX < ( window.innerWidth - $LocalMenu.width() * 0.9 ) )
			{
				bInLocalMenuDrag = true;
				bInDismissMenuDrag = true;
			}
		}
		else
		{
			var nClientXAsPct = 100 * Touch.clientX / window.innerWidth;
			bInDismissMenuDrag = false;
			if ( nClientXAsPct > 93 && LocalMenuEvents )
				bInLocalMenuDrag = true;
			else if ( nClientXAsPct < 7 && MainMenuEvents )
				bInMainMenuDrag = true;
		}

		if ( bInLocalMenuDrag || bInMainMenuDrag )
		{
			bLooksLikeSwipe = false;
			nTouchStartPageX = Touch.pageX;
			nTouchStartPageY = Touch.pageY;
		}
	});
	$(window ).on('touchmove.ResponsiveMenuActive', function(e) {
		if ( !bInLocalMenuDrag && !bInMainMenuDrag )
			return;

		var Touch = fnGetSingleTouch(e);
		if ( !Touch )
			return;
		var nDeltaPageX = Touch.pageX - nTouchStartPageX;
		var nDeltaPageY = Touch.pageY - nTouchStartPageY;

		if ( ( bInLocalMenuDrag && !bInDismissMenuDrag ) || ( bInMainMenuDrag && bInDismissMenuDrag ) )
			nDeltaPageX = -nDeltaPageX;

		var DragMenuEvents = bInMainMenuDrag ? MainMenuEvents : LocalMenuEvents;
		var $DragMenu = bInMainMenuDrag ? $Menu : $LocalMenu;

		if ( !bLooksLikeSwipe && nDeltaPageX > 25 && nDeltaPageX > nDeltaPageY * 2 )
		{
			// horizontal drag
			$Frame.addClass('in_menu_drag');
			if ( !bInDismissMenuDrag )
				DragMenuEvents.fnActivateMenu();
			//$Frame.addClass( bInLocalMenuDrag ? 'localmenu_active' : 'mainmenu_active' );
			nDragMenuWidth = $DragMenu.width();
			bLooksLikeSwipe = true;
		}
		else if ( nDeltaPageY > 2 * nDeltaPageX )
		{
			// looks like scrolling?
			fnCancelDrag();
			return;
		}


		if ( bLooksLikeSwipe )
		{
			nCurDragOffset = Math.max( Math.min( nDeltaPageX, nDragMenuWidth ), 0 );

			var nOffset = bInDismissMenuDrag ? -nCurDragOffset : -(nDragMenuWidth - nCurDragOffset);

			$DragMenu.parents('.responsive_page_menu_ctn' ).css( bInLocalMenuDrag ? 'right' : 'left', nOffset + 'px' );
		}
	});
	$(window ).on('touchend.ResponsiveMenuActivate touchcancel.ResponsiveMenuActivate', function(e) {
		fnCancelDrag();
	});
}

function Responsive_InitTouchDetection( $ )
{
	var $HTML= $J('html');
	if ( !$HTML.hasClass('touch') && $HTML.hasClass('responsive') )
	{
		$J(window ).one('touchstart', function() {
			// user is on a touch device - enable touch-friendly accessors and
			// remember for the rest of this session

			$HTML.addClass('touch');
			V_SetCookie( "strResponsiveViewPrefs", 'touch', 0 );
		} );
	}
}

function Responsive_InitTabSelect( $ )
{
	// handle any tab dropdowns
	$J(document).on('change.ResponsiveTabSelect', 'select.responsive_tab_select', function() {
		var url = $J(this ).val();
		if ( url != window.location )
			window.location = url;
	});
}

function Responsive_InitFixOnScroll($)
{
	var $Ctn = $J('.responsive_fixonscroll_ctn');
	var $Elements = $J('.responsive_fixonscroll');
	if ( $Elements.length )
	{
		var nCtnTop = -1;
		var nCtnHeight = 0;

		$J(window).on('scroll.ResponsiveFixOnScroll resize.ResponsiveFixOnScroll', function() {
			var nHeaderOffset = GetResponsiveHeaderFixedOffsetAdjustment();
			var nScrollTop = $J(window ).scrollTop() + nHeaderOffset + nCtnHeight;

			if ( nHeaderOffset != nCtnTop )
			{
				nCtnTop = nHeaderOffset;
				$Ctn.css( 'top', nCtnTop + 'px' );
			}
			$Elements.each( function() {
				var $Element = $J(this);
				if ( !$Element.is(':visible') )
				{
					if ( $Element.hasClass('in_fixed_ctn') && $Element.data('originalContents') )
					{
						$Element.append( $Element.data('originalContents') );
						$Element.removeClass('in_fixed_ctn');
						$Element.css('height', '');
						nCtnHeight = $Ctn.height();
					}
					return;
				}

				var nElementTop = $Element.offset().top;
				if ( nElementTop > nScrollTop )
				{
					if ( $Element.hasClass('in_fixed_ctn') )
					{
						$Element.append( $Element.data('originalContents') );
						$Element.removeClass('in_fixed_ctn');
						$Element.css('height', '');
						nCtnHeight = $Ctn.height();
					}
				}
				else
				{
					if ( !$Element.hasClass('in_fixed_ctn') )
					{
						$Element.css('height', $Element.height() + 'px' );
						$Element.data( 'originalContents', $Element.children() );
						$Ctn.append( $Element.children() );
						$Element.addClass( 'in_fixed_ctn' );
						nCtnHeight = $Ctn.height();
					}
				}
			});
		} );
	}
}

function Responsive_BuildChangeLanguageOption( $MenuItem )
{
	$MenuItem.click( function() {
		var $LanguageForm = $J('<form/>', {'class': 'responsive_change_language_form' } );
		var $SelectBox = $J('<select/>', {'class': 'responsive_change_language_select' } );
		$SelectBox.append(
			$J('<option/>', {value: "english"} ).text( 'English' )
		);
					$SelectBox.append(
				$J('<option/>', {value: "bulgarian"} ).text( 'Български (Bulgarian)' )
			);
					$SelectBox.append(
				$J('<option/>', {value: "czech"} ).text( 'čeština (Czech)' )
			);
					$SelectBox.append(
				$J('<option/>', {value: "danish"} ).text( 'Dansk (Danish)' )
			);
					$SelectBox.append(
				$J('<option/>', {value: "dutch"} ).text( 'Nederlands (Dutch)' )
			);
					$SelectBox.append(
				$J('<option/>', {value: "finnish"} ).text( 'Suomi (Finnish)' )
			);
					$SelectBox.append(
				$J('<option/>', {value: "french"} ).text( 'Français (French)' )
			);
					$SelectBox.append(
				$J('<option/>', {value: "greek"} ).text( 'Ελληνικά (Greek)' )
			);
					$SelectBox.append(
				$J('<option/>', {value: "german"} ).text( 'Deutsch (German)' )
			);
					$SelectBox.append(
				$J('<option/>', {value: "hungarian"} ).text( 'Magyar (Hungarian)' )
			);
					$SelectBox.append(
				$J('<option/>', {value: "italian"} ).text( 'Italiano (Italian)' )
			);
					$SelectBox.append(
				$J('<option/>', {value: "japanese"} ).text( '日本語 (Japanese)' )
			);
					$SelectBox.append(
				$J('<option/>', {value: "koreana"} ).text( '한국어 (Korean)' )
			);
					$SelectBox.append(
				$J('<option/>', {value: "norwegian"} ).text( 'Norsk (Norwegian)' )
			);
					$SelectBox.append(
				$J('<option/>', {value: "polish"} ).text( 'Polski (Polish)' )
			);
					$SelectBox.append(
				$J('<option/>', {value: "portuguese"} ).text( 'Português (Portuguese)' )
			);
					$SelectBox.append(
				$J('<option/>', {value: "brazilian"} ).text( 'Português-Brasil (Portuguese-Brazil)' )
			);
					$SelectBox.append(
				$J('<option/>', {value: "russian"} ).text( 'Русский (Russian)' )
			);
					$SelectBox.append(
				$J('<option/>', {value: "romanian"} ).text( 'Română (Romanian)' )
			);
					$SelectBox.append(
				$J('<option/>', {value: "schinese"} ).text( '简体中文 (Simplified Chinese)' )
			);
					$SelectBox.append(
				$J('<option/>', {value: "spanish"} ).text( 'Español (Spanish)' )
			);
					$SelectBox.append(
				$J('<option/>', {value: "swedish"} ).text( 'Svenska (Swedish)' )
			);
					$SelectBox.append(
				$J('<option/>', {value: "tchinese"} ).text( '繁體中文 (Traditional Chinese)' )
			);
					$SelectBox.append(
				$J('<option/>', {value: "thai"} ).text( 'ไทย (Thai)' )
			);
					$SelectBox.append(
				$J('<option/>', {value: "turkish"} ).text( 'Türkçe (Turkish)' )
			);
		
		var Modal = null;

		var fnChangeLanguage = function() {
			if ( $SelectBox.val() != "english" )
				ChangeLanguage( $SelectBox.val() );
			Modal && Modal.Dismiss();
		};

		$LanguageForm.submit( function(e) {
			e.preventDefault();
			fnChangeLanguage();
		});
		$SelectBox.change( fnChangeLanguage );

		$LanguageForm.append( $SelectBox );
		$LanguageForm.append( $J('<input/>', {type: 'submit'} ).hide() );
		Modal = ShowConfirmDialog( 'Change language', $LanguageForm, 'Change language' ).done( fnChangeLanguage );
		$SelectBox.focus();
	});
}

function Responsive_RequestDesktopView()
{
	// we can dynamically switch, but this doesn't trigger the phone to zoom out and some elements don't resize right
	/*
	$J('html' ).removeClass('responsive touch' ).addClass('force_desktop');
	$J('meta[name=viewport]' ).attr('value', '' );
	$J(window ).trigger('resize');
	*/
	Responsive_UpdateResponsivePrefs( 'desktop', true );
	window.location.reload();
}

function Responsive_RequestMobileView()
{
	/*
	$J('html' ).removeClass('force_desktop' ).addClass('responsive');
	$J('meta[name=viewport]' ).attr('value', 'width=device-width,initial-scale=1' );
	$J(window ).trigger('resize');
	*/
	Responsive_UpdateResponsivePrefs( 'desktop', false );
	window.location.reload();
}


function Responsive_UpdateResponsivePrefs( strFlag, bEnabled )
{
	if ( bEnabled )
	{
		V_SetCookie( "strResponsiveViewPrefs", strFlag, 365 );
	}
	else
	{
		V_SetCookie( "strResponsiveViewPrefs", null, -1 );
	}
}

function Responsive_InitResponsiveToggleEvents( $ )
{
	// initially undefined, so we will fire the events at at start
	var bTouchFriendly, bSmallScreen;

	$(window).on('resize.ResponsiveToggle', function() {
		if ( window.UseTouchFriendlyMode() !== bTouchFriendly )
		{
			bTouchFriendly = window.UseTouchFriendlyMode();
			$(window).trigger('Responsive_TouchFriendlyModeToggled');
		}

		if ( window.UseSmallScreenMode() !== bSmallScreen )
		{
			bSmallScreen = window.UseSmallScreenMode();
			$(window).trigger('Responsive_SmallScreenModeToggled');
		}
	} ).trigger( 'resize.ResponsiveToggle' );
}

function Responsive_ReparentItemsInResponsiveMode( strItemSelector, $Ctn )
{
	var fnReparentItems = function() {
		var bSmallScreenMode = window.UseSmallScreenMode && window.UseSmallScreenMode();

		var $MoveElements = $J(strItemSelector);
		$MoveElements.each( function() {
			var $Element = $J(this);
			var $OriginalParent = $Element.data('originalParent');
			if ( !$OriginalParent )
			{
				$Element.wrap( $J('<div/>') );
				$OriginalParent = $Element.parent();
				$Element.data('originalParent', $OriginalParent );
			}

			if ( bSmallScreenMode )
			{
				$Ctn.append( $Element );
			}
			else
			{
				$OriginalParent.append( $Element );
			}
		});

	};

	fnReparentItems();
	$J(window ).on('Responsive_SmallScreenModeToggled', fnReparentItems );
}

function Responsive_InitJQPlotHooks( $ )
{
	if ( $.jqplot )
	{
		$.jqplot.postInitHooks.push( function( name, data, options ) {
			var jqplot = this;
			var bWasInResponsiveMode;

			//replotting is very expensive, so we try to delay if the user is actively resizing
			var iReplotInterval;
			$J(window).resize( function() {
				if ( ( UseSmallScreenMode() || bWasInResponsiveMode ) )
				{
					if ( iReplotInterval )
					{
						// we will reschedule for 100ms from now
						window.clearInterval( iReplotInterval );
					}
					else
					{
						//interval hasn't been scheduled yet, must be the first resize.
						// set overflow to hidden so the plot doesn't stretch the page while resizing
						jqplot.target.css( 'overflow', 'hidden' );
					}

					iReplotInterval = window.setTimeout( function() {
						iReplotInterval = null;

						jqplot.replot();

						jqplot.target.css( 'overflow', '' );
					}, 100 );

					bWasInResponsiveMode = UseSmallScreenMode();
				}
			});
		});
	}
}
// Tooltip
jQuery(function($) {
    $('.tooltip').v_tooltip();
    $('#global_header .supernav').v_tooltip({'location':'bottom', 'destroyWhenDone': false, 'tooltipClass': 'supernav_content', 'offsetY':-4, 'offsetX': 1, 'horizontalSnap': 4, 'tooltipParent': '#global_header .supernav_container', 'correctForScreenSize': false});
});

// Notification counter
$J(EnableNotificationCountPolling);

// Register Flyout
RegisterFlyout( 'account_language_pulldown', 'language_dropdown', 'leftsubmenu', 'bottomsubmenu', true );

g_sessionID = "b87c7f9a58a5bd344df8447f";
g_steamID = "76561198008822803";

// We always want to have the timezone cookie set for PHP to use
setTimezoneCookies();

$J( function() {

    InitMiniprofileHovers();
    InitEmoticonHovers();
    window.BindCommunityTooltip = function( $Selector ) { $Selector.v_tooltip( {'tooltipClass': 'community_tooltip', 'dataName': 'communityTooltip' } ); };
    BindCommunityTooltip( $J('[data-community-tooltip]') );
});

$J( function() { InitEconomyHovers( "http:\/\/community.edgecast.steamstatic.com\/public\/css\/skin_1\/economy.css?v=q6EkkWwqjgQx", "http:\/\/community.edgecast.steamstatic.com\/public\/javascript\/economy_common.js?v=tsXdRVB0yEaR&l=english", "http:\/\/community.edgecast.steamstatic.com\/public\/javascript\/economy.js?v=DNiCDdc9ihXn&l=english" );});

g_rgProfileData = {"url":"http:\/\/steamcommunity.com\/id\/diegocard\/","steamid":"76561198008822803","personaname":"DC","summary":" <b>Contact<\/b> <br>• Mail: <a href=\"mailto:diegocard@gmail.com\">diegocard@gmail.com<\/a><br>• Phone: (+598) 99687570<br><br>"};
$J( function() {
    window.Responsive_ReparentItemsInResponsiveMode && Responsive_ReparentItemsInResponsiveMode( '.responsive_groupfriends_element', $J('#responsive_groupfriends_element_ctn') );
});

$J( function() { InitProfileSummary( g_rgProfileData['summary'] ); } );

$J(function () {
    InitializeCommentThread("Profile", "Profile_76561198008822803_0", {
        "feature": "-1",
        "feature2": 0,
        "owner": "76561198008822803",
        "total_count": 0,
        "start": 0,
        "pagesize": 6,
        "has_upvoted": 0,
        "upvotes": 0,
        "votecountid": null,
        "voteupid": null,
        "commentcountid": null,
        "subscribed": false
    }, 'http://steamcommunity.com/comment/Profile/', 40);
});

if ('serviceWorker' in navigator) {
    navigator.serviceWorker
        .register('../service-worker.js')
        .then(function() { console.log('Service Worker Registered'); });
    navigator.serviceWorker
        .ready
        .then(function(registration) { console.log('Service Worker Ready'); }
    );
}
self.addEventListener('install', function(e) {
	e.waitUntil(
		caches.open('diegocard').then(function(cache) {
			return cache.addAll([
				'/',
				'index.html',
				'dist/app.min.js',
				'dist/app.min.css'
			]);
		})
	);
});

self.addEventListener('activate', function(event) {
	event.waitUntil(self.clients.claim());
});
  
self.addEventListener('fetch', function(event) {
	event.respondWith(
		caches.open('diegocard')
		.then(function(cache) {
			cache.match(event.request, {ignoreSearch: true})
		})
		.then(function(response) {
			return response || fetch(event.request);
		})
	);
});