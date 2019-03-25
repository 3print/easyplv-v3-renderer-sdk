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

function impose(json={}) {
  return new Promise(function (resolve, reject) {

    var xhr = new XMLHttpRequest();
    xhr.open("POST", `${ENDPOINT}/impose`);

    xhr.onload = function () {
      if (xhr.status >= 400) {
        console.log('xhr status >= 400');
        return reject(new Error(xhr.response.message));
      }

      resolve(xhr.responseURL);
    };

    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(JSON.stringify(json));

  });

}

let targetWindow;
function target(window) {
  targetWindow = window;
}

function focus(element) {
  let selector;

  switch (element) {
    case 'date':
      selector = '.layout__header__date span';
      break;
    case 'title':
      selector = '.title';
      break;
    case 'subtitle':
      selector = '.subtitle';
      break;
    case 'logo':
      selector = '.logo img';
      break;
    case 'energy':
      selector = '.energy';
      break;
    case 'desc':
      selector = '.desc';
      break;
    case 'details':
      selector = '.details';
      break;
    case 'stickers':
      selector = '.stickers';
      break;
    case 'image':
      selector = '.body__image img';
      break;
    case 'price':
      selector = '.price';
      break;
    case 'subprice':
      selector = '.subprice';
      break;
    case 'tecla':
      selector = '.tecla__in';
      break;
    case 'origin':
      selector = '.origin__in ';
      break;
    case 'mentions':
      selector = '.body__mentions ';
      break;
    case 'gencode':
      selector = '.body__gencode img ';
      break;
    
    default:
      throw new Error('Unsupported element');
      break;
  }

  targetWindow.postMessage({
    action: 'focus',
    selector: selector
  }, '*');
}

export {post, configure, impose, target, focus}
