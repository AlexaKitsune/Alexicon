utils: cosas que interactuan con la base de datos o que no requieren procesamiento complejo, y sobre tod: que son universales para todos los servicios

| Endpoint                     | Method | Auth required | Parameters                             |
|------------------------------|--------|---------------|----------------------------------------|
| `/alexicon/api`              | POST   | ✅            | Body JSON                              |
| `/alexicon/block`            | POST   | ✅            | Body JSON                              |
| `/alexicon/follow`           | POST   | ✅            | Body JSON                              |
| `/alexicon/login`            | POST   | ❌            | Body JSON                              |
| `/alexicon/notifications`    | POST   | ✅            | Body JSON                              |
| `/alexicon/notification_seen`| POST   | ✅            | Body JSON                              |
| `/alexicon/on`               | GET    | ❌            |                                        |
| `/alexicon/register`         | POST   | ❌            | Body JSON                              |
| `/alexicon/retrieve_users`   | POST   | ❌            | Body JSON                              |
| `/alexicon/retrieve`         | GET    | ❌            | Query param (`id`)                     |
| `/alexicon/update_pass`      | POST   | ✅            | Body JSON                              |
| `/alexicon/update_pics`      | POST   | ✅            | Body JSON                              |
| `/alexicon/update_profile`   | POST   | ✅            | Body JSON                              |
| `/alexicon/upload`           | POST   | ✅            | FormData: `file(s)`, `targetPath`      |
| `/yipnet/comment`            | POST   | ✅            | Body JSON                              |
| `/yipnet/delete`             | POST   | ✅            | Body JSON                              |
| `/yipnet/get_single_comment` | GET    | Optional      | Query param (`id`)                     |
| `/yipnet/get_single_post`    | POST   | Optional      | Body JSON (optional token)             |
| `/yipnet/list_comments`      | GET    | ✅            | URL param (`/list_posts/:postId`)      |
| `/yipnet/list_posts`         | GET    | ✅            | URL param (`/list_posts/:targetId`)    |
| `/yipnet/messages`           | POST   | ✅            | Body JSON                              |
| `/yipnet/newsfeed`           | GET    | ✅            |                                        |
| `/yipnet/post`               | POST   | ✅            | Body JSON                              |
| `/yipnet/retrieve_posts`     | POST   | ✅            | Body JSON                              |
| `/yipnet/vote`               | POST   | ✅            | Body JSON                              |





# `/alexicon/api`

Gestiona la clave de API del usuario autenticado: generar una nueva, revocar la existente o consultar la actual.

### Encabezados

- `Authorization`: Token JWT del usuario autenticado. Debe enviarse en el formato: `Bearer <token>`

Recibe:

```js
{
    "mode": "generate" // or "get" or "revoke"
}
```

### Comportamiento

Modos disponibles:

`generate`:
- Genera una clave aleatoria de 64 caracteres (única) y la guarda en el campo api_code.
Devuelve: 
```js
{ status: "ok", api_code: "clave_generada" }
```

`revoke`:
- Elimina el valor de api_code.
Devuelve: 
```js
{ status: "ok", message: "API key revoked." }
```

`get`:
- Devuelve el valor actual de api_code.
Devuelve: 
```js
{ status: "ok", api_code: "clave_actual" }
```





# `/alexicon/block`

Este endpoint permite a un usuario bloquear o desbloquear a otro usuario. Dependiendo del parámetro `mode`, se realiza una de las dos acciones:

- **Block**: Agrega al usuario que hace la solicitud a la lista `list_negative_external` del usuario objetivo, y agrega al usuario objetivo a la lista `list_negative` del usuario que hace la solicitud.

- **Unblock**: Elimina al usuario objetivo de la lista `list_negative` del usuario que hace la solicitud, y elimina al usuario que hace la solicitud de la lista `list_negative_external` del usuario objetivo.


### Encabezados

- `Authorization`: Token JWT del usuario autenticado. Debe enviarse en el formato: `Bearer <token>`

Recibe:

```js
{
    "targetId": 1, // ID del usuario objetivo.
    "mode": "block" // "block" para bloquear al usuario, "unblock" para desbloquearlo.
}
```

### Comportamiento

#### Block:

- Se agrega el myId (ID del usuario autenticado) al array list_negative_external del registro cuyo id es igual a targetId.

- Se agrega el targetId al array list_negative del registro cuyo id es igual a myId.

- Los arrays no deben contener números repetidos. Si alguno de los arrays ya contiene el valor, no se realizará la operación.

#### Unblock:

- Se elimina el targetId del array list_negative del registro cuyo id es igual a myId.

- Se elimina el myId del array list_negative_external del registro cuyo id es igual a targetId.





# `/alexicon/follow`

Este endpoint permite a un usuario seguir o dejar de seguir a otro usuario. Dependiendo del parámetro `mode`, se realiza una de las dos acciones:

- **Follow**: Agrega al usuario que hace la solicitud a la lista `list_positive_external` del usuario objetivo, y agrega al usuario objetivo a la lista `list_positive` del usuario que hace la solicitud.

- **Unfollow**: Elimina al usuario objetivo de la lista `list_positive` del usuario que hace la solicitud, y elimina al usuario que hace la solicitud de la lista `list_positive_external` del usuario objetivo.


### Encabezados

- `Authorization`: Token JWT del usuario autenticado. Debe enviarse en el formato: `Bearer <token>`

Recibe:

```js
{
    "targetId": 1, // ID del usuario objetivo.
    "mode": "follow" // "follow" para seguir al usuario, "unfollow" para dejar de seguir.
}
```

### Comportamiento

#### Follow:

- Se agrega el myId (ID del usuario autenticado) al array list_positive_external del registro cuyo id es igual a targetId.

- Se agrega el targetId al array list_positive del registro cuyo id es igual a myId.

- Los arrays no deben contener números repetidos. Si alguno de los arrays ya contiene el valor, no se realizará la operación.

#### Unfollow:

- Se elimina el targetId del array list_positive del registro cuyo id es igual a myId.

- Se elimina el myId del array list_positive_external del registro cuyo id es igual a targetId.





# `/alexicon/login`

Endpoint para el inicio de sesión. Devuelve datos públicos del usuario y un token que deberá ser almacenado en localStorage para acciones posteriores.

Parámetros esperados (en el cuerpo body):

```js
{
    "access_word": "mail@example.com or @user",
    "password": "secretKey"
}
```

### Uso en frontend

Al iniciar sesión correctamente, el frontend guarda la información en localStorage bajo la clave "AlexiconUserData":

```js
localStorage.setItem("AlexiconUserData", JSON.stringify({
    sessionActive: true,
    userData: { /* datos del usuario */ },
    token: "JWT..."
}));
```




# `/alexicon/notifications`

Devuele las notificaciones de determinado usuario.

### Encabezados

- `Authorization`: Token JWT del usuario autenticado. Debe enviarse en el formato: `Bearer <token>`





# `/alexicon/notification_seen`

Marca una o todas las notificaciones como leídas.


### Encabezados

- `Authorization`: Token JWT del usuario autenticado. Debe enviarse en el formato: `Bearer <token>`

#### Marcar una sola notificación como leída:

Recibe:
```js
{
    "id": 123
}
```

#### Marcar todas las notificaciones como leídas:

Recibe:
```js
{
    "mode": "all"
}
```





# `/alexicon/on`

Devuelve un json `{ active: true }` si el servidor está andando correctamente.





# `/alexicon/register`

Este endpoint permite registrar un nuevo usuario en Alexicon. Recibe los datos personales y de acceso, valida que el correo y el nombre de usuario no estén registrados previamente, y crea el nuevo perfil.

Recibe:

```js
{
    "email": "mail@example.com or @user",
    "password": "secretKey"
    "name": "Nombre",
    "surname": "Apellido",
    "nickname": "user nickname",
    "birthday": "YYYY-MM-DD",
    "gender": "female" // or "male", "other", etc.
}
```

Respuesta:

```js
{
    "response": "User added successfully.",
    "user_data": {
        "id": 2,
        "name": "Alexa",
        "surname": "Kitsune",
        "nickname": "alexita",
        "at_sign": null,
        "birthday": "2024-03-04T06:00:00.000Z",
        "gender": "female",
        "description": null,
        "current_profile_pic": null,
        "current_cover_pic": null,
        "list_positive": "[]",
        "list_negative": "[]",
        "list_positive_external": "[]",
        "list_negative_external": "[]",
        "api_code": 0
    }
}
```

Respuesta si el usuario ya existe:

```js
{
    "response": "User already exists."
}
```

### Uso en frontend

Si el registro es correcto, los datos se mantienen temporalmente en el front para iniciar sesión con `/alexicon/login`. Entonces, son eliminados.





# `/alexicon/retrieve`

Este endpoint permite obtener la información pública de un usuario registrado en la base de datos, dado su `id`.

### Parámetros de consulta

- `id`: (number) Obligatorio. Identificador numérico único del usuario. (`?id=`)

Respuesta:

```js
{
    "id": 23,
    "name": "María",
    "surname": "López",
    "nickname": "Mariluz",
    "at_sign": "@mariluz",
    "birthday": "1995-08-10",
    "gender": "female",
    "description": "Apasionada por la filosofía y el arte.",
    "current_profile_pic": "profile123.jpg",
    "current_cover_pic": "cover456.jpg",
    "list_positive": [1, 5, 8],
    "list_negative": [2],
    "list_positive_external": [],
    "list_negative_external": [7],
    "api_code": 1
}
```





# `/alexicon/retrieve_users`

Este endpoint recibe desde el front un array de IDs de usuarios y devuelve la información pública de esos usuarios desde la base de datos.
Incluye datos como nombre, apellidos, nickname, foto de perfil, listas de votos y demás información relevante.
Solo devuelve registros cuyo ID coincida con los enviados. No requiere autenticación.

Recibe:

```js
{
    ids: [1, 2, 3]
}
```

Respuesta

```js
[
    {
        "id": 1,
        "name": "John",
        "surname": "Doe",
        "nickname": "johnny",
        "at_sign": "@john",
        "birthday": "1990-01-01",
        "gender": "male",
        "description": "A user",
        "current_profile_pic": "pic1.jpg",
        "current_cover_pic": "cover1.jpg",
        "list_positive": [],
        "list_negative": [],
        "list_positive_external": [],
        "list_negative_external": [],
        "api_code": 1
    },
    // ...
]
```





# `/alexicon/update_pass/`

Actualiza la contraseña.

### Encabezados

- `Authorization`: Token JWT del usuario autenticado. Debe enviarse en el formato: `Bearer <token>`

Recibe:

```js
{
    oldPass: "OldPass123",
    newPass: "NewPass321"
}
```





# `/alexicon/update_pics/`

Actualiza la imagen de perfil o portada del usuario autenticado.

### Encabezados

- `Authorization`: Token JWT del usuario autenticado. Debe enviarse en el formato: `Bearer <token>`

Recibe:

```js
{
    "pic": "profile",  // "profile" o "cover"
    "url": "https://example.com/image.jpg"
}
```

Respuesta:

```js
{
    "status": "ok",
    "message": "Picture updated."
}
```





# `/alexicon/update_profile/`

Actualiza los datos públicos del usuario.

Recibe:

```js
{
    name: 'John',
    surname: 'Doe',
    nickname: 'johnny',
    at_sign: 'john_doe',
    gender: 'male',
    description: 'Just a guy who loves coding.',
}
```

### Comportamiento

Los datos `nickname` y `at_sign` deben ser únicos para cada usuario. Si existe otro usuario con los mismos datos en los respectivos campos, se devuelve un error.





# `/alexicon/upload`

Permite subir un archivo a una ruta específica dentro de `storage/`. Este endpoint sólo admite un archivo, pero puede ser utilizado varias veces.

### Form data parameters

- `file`: Archivo que se desea subir (solo uno).

- `targetPath`: Ruta relativa dentro de `/storage` donde se guardará el archivo.  

  Ejemplo: `"yipnet/1/"` → se guardará como `storage/yipnet/1/filename.ext`


### Comportamiento

- Si la carpeta especificada no existe, será creada.

- Si un archivo con el mismo nombre ya existe, se renombrará automáticamente.

- El endpoint valida el tipo de archivo y el tamaño.

- Archivos multimedia grandes pueden ser comprimidos automáticamente (por ejemplo, videos).

Respuesta:

```js
{
    "status":"ok",
    "filename":"Cat03_1746490005668.jpg",
    "relativePath":"yipnet/1/Cat03_1746490005668.jpg"
}
```





# `/yipnet/comment`

Este endpoint permite crear o eliminar comentarios en un post. Requiere autenticación mediante token JWT.

### Encabezados

- `Authorization`: Token JWT del usuario autenticado. Debe enviarse en el formato: `Bearer <token>`

### Comportamiento

#### Agregar comentario

Recibe:

```js
{
  "postId": 1, // id del post donde se comenta.
  "content": "Texto del comentario",
  "media": ["imagen1.png", "imagen2.jpg"]
}
```

Respuesta:

```js
{
  "status": "ok",
  "id": 123 // id del comentario creado.
}
```

#### Eliminar comentario

Recibe:

```js
{
  "mode": "delete", // Obligatorio.
  "id": 123 // id del comentario a eliminar.
}
```

Respuesta:

```js
{
    "status": "ok",
    "message": "Comment deleted successfully."
}
```





# `/yipnet/delete`

Elimina un comentario o una publicación.

### Encabezados

- `Authorization`: Token JWT del usuario autenticado. Debe enviarse en el formato: `Bearer <token>`

Recibe:

```js
{
  "type": "post", // 'post' o 'comment'.
  "id": 123 // id del post o comentario a eliminar.
}
```





# `/yipnet/get_single_comment`

Obtiene un comientario por su ID.

### Parámetros de consulta

- `id`: (number) Obligatorio. ID del comentario que se desea obtener. (`?id=`)

### Encabezados

- `Authorization`: Token JWT del usuario autenticado. Debe enviarse en el formato: `Bearer <token>`

### Comportamiento

- Si el token está presente, se realiza la solicitud al servidor.
- Si el comentario es accesible según las reglas del backend (comentario de un post público o privado al que el usuario tiene acceso, y el autor no está bloqueado), se muestra en la consola.
- Si hay un error (como falta de acceso, token inválido, o comentario inexistente), se imprime un mensaje de error en la consola.





# `/yipnet/get_single_post`

Este endpoint devuelve los datos de un post específico según su `id`.

### Parámetros de consulta

- `id`: (number) Obligatorio. ID del post que se desea obtener. (`?id=`)

### Encabezados opcionales

- `Authorization`: Token JWT del usuario autenticado. Debe enviarse en el formato: `Bearer <token>`

### Comportamiento

Si no se proporciona token:

- Solo se devolverá el post si `private_post` es `0`.

Si se proporciona token:

- Si `private_post` es `0`, el post será devuelto sin restricciones.

- Si `private_post` es `1`, el post solo será devuelto si el `owner_id` coincide con el usuario del token.

Respuesta:
```js
{
    "id": 123,
    "owner_id": 1,
    "content": "Texto del post",
    "media": [],
    "shared_by_list": [],
    "share_id": 0,
    "private_post": 0,
    "nsfw_post": 0,
    "comment_count": 5,
    "list_vote_heart": [],
    "list_vote_up": [],
    "list_vote_down": [],
    "post_date": "2025-05-05T10:00:00.000Z"
}
```





# `/yipnet/list_comments/`

Obtiene una lista de comentarios de un post especificado por su ID.

### Parámetros de consulta

- `id`: (number) Obligatorio. ID del post del que se desean obtener comentarios. (`?id=`)

### Encabezados opcionales

- `Authorization`: Token JWT del usuario autenticado. Debe enviarse en el formato: `Bearer <token>`

### Comportamiento

- Si el post es **público**, cualquier usuario autenticado puede obtener sus comentarios.
- Si el post es **privado**, solo el dueño del post (el ID obtenido del token debe coincidir con el `owner_id` del post) puede ver los comentarios.
- En ambos casos, **no se mostrarán los comentarios de usuarios que estén bloqueados**, es decir, si su `owner_id` aparece en los arrays `list_negative` o `list_negative_external` del usuario autenticado.





# `/yipnet/list_posts/`

Devuelve una lista de publicaciones de un usuario objetivo, dependiendo de si el usuario autenticado tiene permiso para verlas.

### Parámetros de consulta

- `targetId`: (number) Obligatorio. ID del usuario del cual se desea obtener las publicaciones. (`/yipnet/list_posts/<targetId>`)

### Encabezados

- `Authorization`: Token JWT del usuario autenticado. Debe enviarse en el formato: `Bearer <token>`

### Comportamiento

- Si el token no es válido o no se proporciona, se devuelve un error 401.

- Si el `targetId` está incluido en las listas `list_negative` o `list_negative_external` del usuario autenticado, se devuelve una lista vacía.

- Si `targetId === id` del usuario autenticado, se devuelven todas las publicaciones.

- Si `targetId !== id` del usuario autenticado, solo se devuelven publicaciones con private_post = 0.

Respuesta:

```js
{
    "status": "ok",
    "message": {
        "post_list": [
            {
                "id": 123,
                "owner_id": 5,
                "content": "Texto de la publicación",
                "media": "[\"media1.jpg\"]",
                "shared_by_list": "[]",
                "share_id": null,
                "private_post": 0,
                "nsfw_post": 0,
                "comment_count": 0,
                "list_vote_heart": "[]",
                "list_vote_up": "[]",
                "list_vote_down": "[]",
                "post_date": "2025-05-05T15:32:00.000Z",
                "name": "Nombre",
                "surname": "Apellido",
                "currentProfilePic": "avatar.jpg"
            },
            // Other posts if any...
        ]
    }
}
```




# `/yipnet/messages`

Agrega un nuevo mensaje.

### Encabezados

- `Authorization`: Token JWT del usuario autenticado. Debe enviarse en el formato: `Bearer <token>`

Recibe:

```js
{
    "media": [],
    "content": "Hello",
    "targetId": 123,
    "conversationId": 0
}
```





# `/yipnet/newsfeed`

Obtiene las publicaciones del feed personalizadas para el usuario autenticado, basado en su lista `list_positive` (seguimientos).

### Encabezados

- `Authorization`: Token JWT del usuario autenticado. Debe enviarse en el formato: `Bearer <token>`





# `/yipnet/post`

Crea un nuevo post con ciertos datos del usuario. Devuelve el `id` del post una vez publicado.

Recibe:

```js
{
    content: "This is a new post",
    media: JSON.stringify([ /* URLs de los archivos */ ]),
    shareId: 0, // 0 if not share, any other number is the id of the shared post.
    privatePost: 0, // or 1.
    nsfwPost: 0 // or 1.
}
```

Respuesta:

```js
{
    response: 'Post created successfully.',
    post_id: 123
}
```





# `/yipnet/retrieve_posts`

Este endpoint recibe desde el front un array de IDs de los posts y devuelve dichos posts en un array.

### Encabezados

- `Authorization`: Token JWT del usuario autenticado. Debe enviarse en el formato: `Bearer <token>`

Recibe:

```js
{
    ids: [1, 2, 3]
}
```





# `/yipnet/vote`

Este endpoint permite a un usuario votar (o retirar su voto, si ya estaba) en una publicación o comentario. El tipo de voto puede ser `heart`, `up` o `down`.

### Encabezados

- `Authorization`: Token JWT del usuario autenticado. Debe enviarse en el formato: `Bearer <token>`

Recibe:

```js
{
    "voteType": "heart", // "heart", "up" or "down".
    "targetId": 1, // ID del post o comentario a votar.
    "entityTyoe": "post" // "post" or "comment".
}
```





---
Tabla:
    Nombre del endpoint
    Metodo
    Requiere token de autenticacion

Access word puede ser el correo o el token