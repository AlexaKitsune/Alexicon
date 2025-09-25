export function TOKEN(){
    return JSON.parse(localStorage.getItem("AlexiconUserData")).token;
}

function buildFormData(obj = {}){
    const fd = new FormData();
    Object.entries(obj).forEach(([key, val]) => {
        if (val == null) return;

        if (val instanceof Blob || val instanceof File) {
            fd.append(key, val);
        } else if (Array.isArray(val)) {
        // Permite múltiples archivos o valores
        val.forEach(item => {
            if (item instanceof Blob || item instanceof File) fd.append(key, item);
            else if (typeof item === 'object') fd.append(key, JSON.stringify(item));
            else fd.append(key, String(item));
        });
        } else if (typeof val === 'object') {
            // Objetos: los mandamos como JSON en formData
            fd.append(key, JSON.stringify(val));
        } else {
            fd.append(key, String(val));
        }
    });
    return fd;
}

// ENDPOINT FUNCTIONS

// alexion/api

// alexicon/block
export async function alexicon_BLOCK(endpoint_, token_, data_){
    const response = await fetch(`${endpoint_}/alexicon/block`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token_}`
        },
        body: JSON.stringify(data_)
    })
    return await response.json();
}

// alexicon/follow
export async function alexicon_FOLLOW(endpoint_, token_, data_){
    const response = await fetch(`${endpoint_}/alexicon/follow`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token_}`
        },
        body: JSON.stringify(data_)
    })
    return await response.json();
}

// alexicon/login
export async function alexicon_LOGIN(endpoint_, userData_){
    const response = await fetch(`${endpoint_}/alexicon/login`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(userData_)
    })
    return await response.json();
}

// alexicon/notifications
export async function alexicon_NOTIFICATIONS(endpoint_, token_){
    const response = await fetch(`${endpoint_}/alexicon/notifications`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token_}`
        }
    })
    return await response.json();
}

// alexicon/notification_seen
export async function alexicon_NOTIFICATION_SEEN(endpoint_, token_, data_){
    const response = await fetch(`${endpoint_}/alexicon/notification_seen`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token_}`
        },
        body: JSON.stringify(data_)
    })
    return await response.json();
}

// alexicon/on

// alexicon/register
export async function alexiconREGISTER(endpoint_, userData_){
    const response = await fetch(`${endpoint_}/alexicon/register`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(userData_)
    })
    return await response.json();
}

// alexicon/report
export async function alexicon_REPORT(endpoint_, token_, data_){
    const response = await fetch(`${endpoint_}/alexicon/report`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token_}`
        },
        body: JSON.stringify(data_)
    })
    return await response.json();
}

// alexicon/retrieve_users
export async function alexicon_RETRIEVE_USERS(endpoint_, data_){
    const response = await fetch(`${endpoint_}/alexicon/retrieve_users`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data_)
    })
    return await response.json();
}

// alexicon/retrieve
export async function alexicon_RETRIEVE(endpoint_, profileId_){
    const response = await fetch(`${endpoint_}/alexicon/retrieve?id=${profileId_}`, {
        method: "GET",
    })
    return await response.json();
}

// alexicon/update_pass
export async function alexicon_UPDATE_PASS(endpoint_, token_, data_){
    const response = await fetch(`${endpoint_}/alexicon/update_pass`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token_}`
        },
        body: JSON.stringify(data_)
    })
    return await response.json();
}

// alexicon/update_pics
export async function alexicon_UPDATE_PICS(endpoint_, token_, data_){
    const response = await fetch(`${endpoint_}/alexicon/update_pics`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token_}`
        },
        body: JSON.stringify(data_)
    })
    return await response.json();
}

// alexicon/update_profile
export async function alexicon_UPDATE_PROFILE(endpoint_, token_, data_){
    const response = await fetch(`${endpoint_}/alexicon/update_profile`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token_}`
        },
        body: JSON.stringify(data_)
    })
    return await response.json();
}

// alexicon/upload
export async function alexicon_UPLOAD(endpoint_, token_, formData_){
    const formData = buildFormData(formData_);
    const response = await fetch(`${endpoint_}/alexicon/upload`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token_}`
        },
        body: formData
    })
    return await response.json();
}

// 
function parseContentDispositionFilename(cd) {
  if (!cd) return null;
  const m = /filename="(.+?)"/i.exec(cd);
  return m ? m[1] : null;
}

// alexicon/media/file
export async function alexicon_MEDIA_FILE(endpoint_, token_=null, id_){
    const url = `${endpoint_}/alexicon/media/file/${id_}`;
    const headers = {};
    if (token_) headers["Authorization"] = `Bearer ${token_}`;
    
    const response = await fetch(url, { method: "GET", headers, cache: "no-store" });

    const type = response.headers.get("content-type") || "";
    const filename =
        response.headers.get("X-Filename") ||
        parseContentDispositionFilename(response.headers.get("Content-Disposition"));

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    return { url: blobUrl, type, filename, isBlob: true };
}

// yipnet/comment
export async function yipnet_COMMENT(endpoint_, token_, data_){
    const response = await fetch(`${endpoint_}/yipnet/comment`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token_}`
        },
        body: JSON.stringify(data_)
    })
    return await response.json();
}

// yipnet/delete
export async function yipnet_DELETE(endpoint_, token_, data_){
    const response = await fetch(`${endpoint_}/yipnet/delete`, {
        method: 'POST',
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token_}`
        },
        body: JSON.stringify(data_)
    })
    return await response.json();
}

// yipnet/get_messages
export async function yipnet_GET_MESSAGES(endpoint_, token_, profileId_){
    const response = await fetch(`${endpoint_}/yipnet/get_messages?user=${profileId_}`, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${token_}`
        }
    })
    return await response.json();
}

// yipnet/get_single_comment

// yipnet/get_single_post
export async function yipnet_GET_SINGLE_POST(endpoint_, token_=null, postId_){
    const headers = {
        "Content-Type": "application/json"
    };
    if (token_) headers["Authorization"] = `Bearer ${token_}`;
    const response = await fetch(`${endpoint_}/yipnet/get_single_post?id=${postId_}`, {
        method: "GET",
        headers
    })
    return await response.json();
}

// yipnet/list_comments
export async function yipnet_LIST_COMMENTS(endpoint_, token_, postId_){
    const response = await fetch(`${endpoint_}/yipnet/list_comments/${postId_}`, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${token_}`
        }
    })
    return await response.json();
}

// yipnet/list_messages
export async function yipnet_LIST_MESSAGES(endpoint_, token_){
    const response = await fetch(`${endpoint_}/yipnet/list_messages`, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${token_}`
        }
    })
    return await response.json();
}

// yipnet/list_posts
export async function yipnet_LIST_POSTS(endpoint_, token_, profileId_){
    const response = await fetch(`${endpoint_}/yipnet/list_posts/${profileId_}`, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${token_}`
        }
    })
    return await response.json();
}

// yipnet/message
export async function yipnet_MESSAGE(endpoint_, token_, data_){
    const response = await fetch(`${endpoint_}/yipnet/message`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token_}`
        },
        body: JSON.stringify(data_)
    })
    return await response.json();
}

// yipnet/newsfeed
export async function yipnet_NEWSFEED(endpoint_, token_){
    const response = await fetch(`${endpoint_}/yipnet/newsfeed`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token_}`
        }
    })
    return await response.json();
}

// yipnet/post
export async function yipnet_POST(endpoint_, token_, data_){
    const response = await fetch(`${endpoint_}/yipnet/post`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token_}`
        },
        body: JSON.stringify(data_)
    })
    return await response.json();
}

// yipnet/retrieve_posts
export async function yipnet_RETRIEVE_POSTS(endpoint_, token_, data_){
    const response = await fetch(`${endpoint_}/yipnet/retrieve_posts`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token_}`
        },
        body: JSON.stringify(data_)
    })
    return await response.json();
}

// yipnet/vote
export async function yipnet_VOTE(endpoint_, token_, voteData_){
    const response = await fetch(`${endpoint_}/yipnet/vote`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token_}`
        },
        body: JSON.stringify(voteData_)
    })
    return await response.json();
}