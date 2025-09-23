# ALEXICON

Arrancamos el servidor usando el siguiente comando:

```
node app.js
```

Debes tener MySQL corriendo de fondo, para realizar las conexiones a la base de datos.

La creación de la base de datos se describe en `utils/schema.sql` y se ejecuta automáticamente por `utils/dbSetup.js`.

## Endpoints

Para realizar su conexión con el servidor, los frontend no necesitan escribir cada fetch independientemente.
Para reutilizar código, tener un código limpio y mantener todo actualizado al unísono, este servidor servirá los endpoints desde la ruta (`/endpoints.js`) como un archivo .js

Este archivo contiene las funciones de fetch a los endpoints, por ejemplo:

```js
// alexicon/login
export async function alexiconLOGIN(endpoint_, userData_){
    const response = await fetch(`${endpoint_}/alexicon/login`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(userData_)
    })
    return await response.json();
}

// ...
```

Para utilizarlo en nuestro proyecto de vue, lo insertamos así en `src/main.js`:

```js
// main.js
import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)

const ENDPOINT = 'http://localhost:5001'

async function loadApi() {
    const api = await import(/* webpackIgnore: true */`${ENDPOINT}/endpoints.js`);

    app.config.globalProperties.$ENDPOINT = 'http://localhost:5001';

    Object.entries(api).forEach(([name, fn]) => {
        app.config.globalProperties[name] = fn
    });

    app.mount('#app');
}

loadApi()
```

Y lo utilizamos de la siguiente manera en nuestros componentes:

```js
methods: {
    my_method(){
        const result = await this.alexicon_LOGIN(/* parameters */);
        // ...
    },
}
```

## Frontend

Aunque cada frontend tenga su configuración específica según sus necesidades, todos comparten ciertas características en común, y deberán compartirlas para ser compatibles con este backend.

Estas características en común son:

- Están hechas con vue cli (o html/js vanilla en su defecto).
- Las funciones de los endpoints son servidas desde este backend (`/endpoints.js`).