let ENDPOINT = '';

function configure(settings) {
  ENDPOINT = settings.ENDPOINT;
}

//
// SSE connection to get information back about our async job (pushed from the server)
//
function jobUpdate(id, ttl) {
  return new Promise(function (resolve, reject) {
    let url = `${ENDPOINT}/updates/${id}`;
    let eventSource = new EventSource(url);

    //
    // We will timeout the promise if no SSE received since `ttl` milliseconds
    //
    let timeout;
    if (ttl) {
      timeout = setTimeout(function () {
        let er = new Error('Timeout: the server had not pushed anything to the eventsource.');

        reject(er);
        eventSource.close()
      }, ttl);
    }

    eventSource.onmessage = function (e) {
      timeout && clearTimeout(timeout); // cancel the timeout
      eventSource.close();

      let data = JSON.parse(e.data);

      if ('error' in data) {
        reject(new Error(data.error));
      } else {
        resolve(data.result);
      }
    }

    eventSource.onerror = function (er) {
      reject(er);
      eventSource.close()
    };
  })
}

function post(headers={}, json={}) {
  return new Promise(function (resolve, reject) {
    //console.log('sending a new request', headers, json)

    let xhr = new XMLHttpRequest();
    xhr.responseType = 'blob';
    xhr.open("POST", `${ENDPOINT}/`);

    xhr.onload = async function () {
      if (xhr.status >= 400) {
        console.log('xhr status >= 400');
        return reject(new Error(xhr.response.message));
      }

      let response;
      if (xhr.status === 202) {
        //
        // async
        //

        console.log('202 accepted');

        let location = xhr.getResponseHeader('Location');
        if (location.length <= 0) {
          return reject(new Error('No `Location` header in the 202 response.'))
        }

        let jobid = location.match(new RegExp('/queue/([0-9]+)'))[1]

        try {
          response = await jobUpdate(jobid); // response will contain the S3 URL
        } catch(er) {
          return reject(er);
        }

      } else {
        //
        // sync
        //

        response = xhr.response; // will be a blob since xhr.responseType='blob'
        response = window.URL.createObjectURL(response);
      }

      resolve(response);
    };
    xhr.onerror = reject;

    xhr.setRequestHeader('Content-Type', 'application/json') // to override `text/html` from ajax
    for (let k in headers) {
      xhr.setRequestHeader(k, headers[k]);
    }

    xhr.send(JSON.stringify(json));
  });
}

export {post, configure}
