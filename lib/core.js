var hljs = require('highlight.js')
var loaderUtils = require('loader-utils')
var markdown = require('markdown-it')

/**
 * `{{ }}` => `<span>{{</span> <span>}}</span>`
 * @param  {string} str
 * @return {string}
 */
var replaceDelimiters = function (str) {
  return str.replace(/({{|}})/g, '<span>$1</span>')
}

/**
 * renderHighlight
 * @param  {string} str
 * @param  {string} lang
 */
var renderHighlight = function (str, lang) {
  if (!(lang && hljs.getLanguage(lang))) {
    return ''
  }

  try {
    return replaceDelimiters(hljs.highlight(lang, str, true).value)
  } catch (err) {}
}

/**
 * html => vue file template
 * @param  {[type]} html [description]
 * @return {[type]}      [description]
 */
var renderVueTemplate = function (html) {
  return '<section>' + html + '</section>\n'
}

/**
 * Resolves plguins passed as string
 * @param {String|Object} plugin
 * @return {Object}
 */
var resolvePlugin = function (plugin) {
  if (typeof plugin === 'string') {
    return require(plugin)
  }
  return plugin
}

module.exports = function (source) {
  this.cacheable()
  var callback = this.async()

  var parser
  var params = loaderUtils.getOptions(this)
  var opts = Object.assign({}, params)
  var promise = Promise.resolve()

  if (typeof (opts.render) === 'function') {
    parser = opts
  } else {
    opts = Object.assign({
      preset: 'default',
      html: true,
      highlight: renderHighlight
    }, opts)

    var plugins = opts.use
    var preprocess = opts.preprocess

    delete opts.use
    delete opts.preprocess

    parser = markdown(opts.preset, opts)
    if (plugins) {
      promise = Promise.all(plugins.map(function (plugin) {
        if (Array.isArray(plugin)) {
          return Promise.resolve(resolvePlugin(plugin[0])).then(p => {
            plugin[0] = p
            parser.use.apply(parser, plugin)
          })
        } else {
          return Promise.resolve(resolvePlugin(plugin)).then(p => parser.use(p))
        }
      }))
    }
  }

  return promise.then(() => {
    var codeInlineRender = parser.renderer.rules.code_inline;
    parser.renderer.rules.code_inline = function () {
      return replaceDelimiters(codeInlineRender.apply(this, arguments));
    }
  
    if (preprocess) {
      source = preprocess.call(this, parser, source)
    }
  
    var content = parser.render(source)
    
    callback(null, renderVueTemplate(content))
  }).catch(err => callback(err))
}
