import FetchError from './error.js'

const requestMethods = ['delete', 'get', 'head']
const dataMethods = ['patch', 'post', 'put']

const responseTypes = {
  arrayBuffer: '*/*',
  blob: '*/*',
  formData: 'multipart/form-data',
  json: 'application/json',
  text: 'text/*',
}

/**
 * @typedef {import('./types').Defaults} Defaults
 * @typedef {import('./types').Options} Options
 * @typedef {import('./types').Rek} Rek
 *
 * @param {Defaults} defaults
 * @returns {Rek}
 */
export default function factory(defaults) {
  function rek(url, options) {
    if (typeof options === 'string') options = { response: options }

    options = Object.assign({}, defaults, options)

    if (options.baseUrl) {
      url = new URL(url, options.baseUrl).href
    }

    if (options.searchParams) {
      url = url.split('?')[0] + '?' + new URLSearchParams(options.searchParams)
    }

    options.headers = new options.Headers(Object.assign({}, defaults.headers, options.headers))

    const { body, headers, response, fetch } = options

    if (body && typeof body === 'object') {
      // check if FormData or URLSearchParams
      if (typeof body.append === 'function') headers.delete('content-type')
      // check if ReadableStream (.getReader), Blob (.stream), ArrayBuffer or
      // DataView (.byteLength and .slice or .getInt8)
      else if (
        typeof (body.getReader || body.stream) !== 'function' &&
        (typeof body.byteLength !== 'number' || typeof (body.slice || body.getInt8) !== 'function')
      ) {
        options.body = JSON.stringify(body)
        headers.set('content-type', 'application/json')
      }
    }

    let onFullfilled

    if (response) {
      if (typeof response === 'function') {
        onFullfilled = response
      } else if (response in responseTypes) {
        headers.set('accept', responseTypes[response])

        onFullfilled = (res) => (res.status === 204 ? null : res[response]())
      } else {
        throw new Error('Unknown response type: ' + response)
      }
    }

    const res = fetch(url, options).then((res) => {
      if (res.ok) return res

      return res
        .text()
        .then((text) => {
          try {
            return JSON.parse(text)
          } catch {
            return text || null
          }
        })
        .catch(() => null)
        .then((body) => {
          throw new FetchError(res, body)
        })
    })

    return onFullfilled ? res.then(onFullfilled) : res
  }

  requestMethods.forEach((method) => {
    rek[method] = (url, options) => rek(url, Object.assign({}, options, { method: method.toUpperCase() }))
  })

  dataMethods.forEach((method) => {
    rek[method] = (url, body, options) => rek(url, Object.assign({}, options, { body, method: method.toUpperCase() }))
  })

  rek.extend = (newDefaults) =>
    factory(
      Object.assign({}, defaults, newDefaults, {
        headers: Object.assign({}, defaults.headers, newDefaults.headers),
      }),
    )

  return rek
}
