// ========================================
// UBICACIÓN DEL USUARIO
// Geolocation API del navegador
// ========================================


// Elementos del DOM

const btnUbicacion =
    document.getElementById("btnUbicacion");

const mensajeUbicacion =
    document.getElementById("mensajeUbicacion");

const selectZona =
    document.getElementById("zona");


// ========================================
// ZONAS DE COBERTURA
// Coordenadas aproximadas del centro de cada zona.
// Ajusta estos valores si quieres más precisión.
// ========================================

const zonasCobertura = [

    {
        valor: "vitarte",
        nombre: "Vitarte",
        lat: -12.0247,
        lon: -76.9440
    },

    {
        valor: "santa-anita",
        nombre: "Santa Anita",
        lat: -12.0433,
        lon: -76.9717
    },

    {
        valor: "ate",
        nombre: "Ate",
        lat: -12.0261,
        lon: -76.8930
    },

    {
        valor: "la-molina",
        nombre: "La Molina",
        lat: -12.0792,
        lon: -76.9447
    },

    {
        valor: "sjl",
        nombre: "San Juan de Lurigancho",
        lat: -11.9797,
        lon: -77.0060
    }

];


// ========================================
// OPCIONES DE LA API
// ========================================

const opcionesGPS = {

    // Pide el GPS del dispositivo en lugar de
    // una estimación por IP o red WiFi
    enableHighAccuracy: true,

    // Máximo 10 segundos esperando respuesta
    timeout: 10000,

    // No aceptar ubicaciones guardadas en caché
    maximumAge: 0

};


// ========================================
// FUNCIÓN AUXILIAR: MOSTRAR MENSAJE
// ========================================

function mostrarMensajeUbicacion(tipo, icono, contenido) {

    mensajeUbicacion.innerHTML =
        '<div class="alert alert-' + tipo + ' mb-0">' +
        '<i class="fas ' + icono + '"></i> ' +
        contenido +
        '</div>';

}


// ========================================
// FUNCIÓN AUXILIAR: DISTANCIA ENTRE DOS PUNTOS
// Fórmula de Haversine, resultado en kilómetros
// ========================================

function calcularDistancia(lat1, lon1, lat2, lon2) {

    // Radio de la Tierra en kilómetros
    const R = 6371;

    const gradosARadianes = grados => grados * Math.PI / 180;

    const dLat = gradosARadianes(lat2 - lat1);
    const dLon = gradosARadianes(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(gradosARadianes(lat1)) *
        Math.cos(gradosARadianes(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;

}


// ========================================
// FUNCIÓN: BUSCAR LA ZONA MÁS CERCANA
// ========================================

function buscarZonaMasCercana(lat, lon) {

    let zonaCercana = null;
    let distanciaMinima = Infinity;

    zonasCobertura.forEach(zona => {

        const distancia =
            calcularDistancia(lat, lon, zona.lat, zona.lon);

        if (distancia < distanciaMinima) {

            distanciaMinima = distancia;
            zonaCercana = zona;

        }

    });

    return {
        zona: zonaCercana,
        distancia: distanciaMinima
    };

}


// ========================================
// FUNCIÓN: CONVERTIR COORDENADAS EN DIRECCIÓN
// Esto se llama "geocodificación inversa".
// Usamos BigDataCloud: es gratuita y no pide API key.
// ========================================

async function obtenerDireccion(lat, lon) {

    const url =
        "https://api.bigdatacloud.net/data/reverse-geocode-client" +
        "?latitude=" + lat +
        "&longitude=" + lon +
        "&localityLanguage=es";

    const respuesta = await fetch(url);

    if (!respuesta.ok) {

        throw new Error("No se pudo consultar el servicio de direcciones");

    }

    const datos = await respuesta.json();

    // Armamos la dirección con las partes que existan
    const partes = [
        datos.locality,
        datos.city,
        datos.principalSubdivision,
        datos.countryName
    ];

    return partes
        .filter(parte => parte && parte.trim() !== "")
        .join(", ");

}


// ========================================
// CASO DE ÉXITO
// El navegador nos entregó la posición
// ========================================

async function ubicacionObtenida(posicion) {

    const lat = posicion.coords.latitude;
    const lon = posicion.coords.longitude;

    // Margen de error en metros que reporta el dispositivo
    const precision = Math.round(posicion.coords.accuracy);

    console.log("Latitud:", lat);
    console.log("Longitud:", lon);
    console.log("Precisión:", precision, "metros");


    // 1. Buscar la zona de cobertura más cercana

    const resultado = buscarZonaMasCercana(lat, lon);


    // 2. Seleccionar esa zona automáticamente en el formulario

    if (resultado.distancia <= 15) {

        selectZona.value = resultado.zona.valor;

    }


    // 3. Intentar obtener la dirección legible

    let direccion = "";

    try {

        direccion = await obtenerDireccion(lat, lon);

    } catch (error) {

        console.warn("Geocodificación inversa falló:", error);

    }


    // 4. Mostrar el resultado al usuario

    let contenido = "<strong>Ubicación detectada</strong><br>";

    if (direccion !== "") {

        contenido += direccion + "<br>";

    }

    contenido +=
        '<small class="text-muted">' +
        "Lat: " + lat.toFixed(6) + " · " +
        "Lon: " + lon.toFixed(6) + " · " +
        "±" + precision + " m" +
        "</small>";


    if (resultado.distancia <= 15) {

        contenido +=
            '<br><small>Zona asignada: <strong>' +
            resultado.zona.nombre +
            "</strong> (a " + resultado.distancia.toFixed(1) + " km)</small>";

        mostrarMensajeUbicacion("success", "fa-location-dot", contenido);

    } else {

        contenido +=
            "<br><small>Estás fuera de nuestras zonas de cobertura. " +
            "La más cercana es <strong>" + resultado.zona.nombre +
            "</strong>, a " + resultado.distancia.toFixed(1) + " km.</small>";

        mostrarMensajeUbicacion("warning", "fa-location-dot", contenido);

    }


    btnUbicacion.disabled = false;

    btnUbicacion.innerHTML =
        '<i class="fas fa-location-crosshairs"></i> Actualizar mi ubicación';

}


// ========================================
// CASO DE ERROR
// ========================================

function ubicacionFallida(error) {

    let texto = "";

    switch (error.code) {

        case error.PERMISSION_DENIED:
            texto =
                "Bloqueaste el permiso de ubicación. " +
                "Actívalo desde el candado de la barra de direcciones " +
                "o elige tu zona manualmente.";
            break;

        case error.POSITION_UNAVAILABLE:
            texto =
                "No se pudo determinar tu ubicación. " +
                "Revisa que el GPS esté encendido.";
            break;

        case error.TIMEOUT:
            texto =
                "La búsqueda tardó demasiado. Inténtalo de nuevo.";
            break;

        default:
            texto = "Ocurrió un error inesperado al obtener tu ubicación.";

    }

    mostrarMensajeUbicacion("danger", "fa-triangle-exclamation", texto);

    btnUbicacion.disabled = false;

    btnUbicacion.innerHTML =
        '<i class="fas fa-location-crosshairs"></i> Usar mi ubicación actual';

}


// ========================================
// FUNCIÓN PRINCIPAL
// ========================================

function detectarUbicacion() {

    // ¿El navegador soporta la API?

    if (!("geolocation" in navigator)) {

        mostrarMensajeUbicacion(
            "danger",
            "fa-circle-xmark",
            "Tu navegador no soporta geolocalización."
        );

        return;

    }


    // La API solo funciona en HTTPS o en localhost

    if (!window.isSecureContext) {

        mostrarMensajeUbicacion(
            "warning",
            "fa-lock",
            "La geolocalización requiere HTTPS o localhost. " +
            "Abre el proyecto con un servidor local (Live Server)."
        );

        return;

    }


    // Estado de carga

    btnUbicacion.disabled = true;

    btnUbicacion.innerHTML =
        '<span class="spinner-border spinner-border-sm"></span> Buscando...';

    mostrarMensajeUbicacion(
        "info",
        "fa-satellite-dish",
        "Solicitando permiso de ubicación..."
    );


    // Llamada a la API

    navigator.geolocation.getCurrentPosition(
        ubicacionObtenida,
        ubicacionFallida,
        opcionesGPS
    );

}


// ========================================
// EVENTO DEL BOTÓN
// ========================================

if (btnUbicacion) {

    btnUbicacion.addEventListener("click", detectarUbicacion);

}