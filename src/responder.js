import { omit, pick } from 'lowline'

const texts = ['text', 'application/xml']

export default function responder (res) {
  const contentType = res.headers.get('content-type')

  if (res.ok) {
    if (contentType) {
      if (contentType.includes('application/json')) {
        return res.json()
      }

      if (texts.some((str) => contentType.startsWith(str))) {
        return res.text()
      }
    }

    return res
  }

  if (contentType && contentType.includes('application/json')) {
    return res.json().then((json) => {
      const err = json.error || json.err || json

      throw Object.assign(new Error(err.message), omit(err, 'message'))
    })
  }

  throw Object.assign(new Error(res.statusText), pick(res, 'status', 'statusText', 'url', 'redirect'))
}
