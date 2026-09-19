// ========================================
// VARIABLES Y CONSTANTES
// ========================================

const mensajeBusqueda =
    document.getElementById("mensajeBusqueda");

const mensajeSolicitud =
    document.getElementById("mensajeSolicitud");

const mensajeLogin =
    document.getElementById("mensajeLogin");


// ========================================
// POPOVERS 
// ========================================

const popoverTriggerList =
    [].slice.call(
        document.querySelectorAll(
            '[data-bs-toggle="popover"]'
        )
    );

const popoverList =
    popoverTriggerList.map(function (popoverTriggerEl) {

        return new bootstrap.Popover(popoverTriggerEl);

    });




// ========================================
// FUNCIÓN SELECCIONAR SERVICIO
// ========================================

function seleccionarServicio(servicio) {

    console.log("Servicio seleccionado:", servicio);

    // Opciones específicas de cada categoría
    const opciones = {

        "Gasfitería": [
            {
                id: "reparacion-fugas",
                icono: "fa-droplet",
                titulo: "Reparación de fugas de agua",
                descripcion: "Reparación de fugas en tuberías, conexiones, grifos y sistemas de agua."
            },
            {
                id: "instalacion-grifos",
                icono: "fa-faucet",
                titulo: "Instalación de grifos",
                descripcion: "Instalación y cambio de grifos para cocina, baño y otros espacios."
            },
            {
                id: "destape-tuberias",
                icono: "fa-wrench",
                titulo: "Destape de tuberías",
                descripcion: "Solución de obstrucciones y problemas de drenaje en tuberías."
            },
            {
                id: "mantenimiento-agua",
                icono: "fa-house",
                titulo: "Mantenimiento de instalaciones de agua",
                descripcion: "Revisión y mantenimiento preventivo de instalaciones de agua."
            }
        ],

        "Electricidad": [
            {
                id: "instalacion-luces",
                icono: "fa-lightbulb",
                titulo: "Instalación de luces",
                descripcion: "Instalación de focos, lámparas y sistemas de iluminación."
            },
            {
                id: "reparacion-circuitos",
                icono: "fa-bolt",
                titulo: "Reparación de circuitos",
                descripcion: "Diagnóstico y reparación de problemas en circuitos eléctricos."
            },
            {
                id: "instalacion-tomacorrientes",
                icono: "fa-plug",
                titulo: "Instalación de tomacorrientes",
                descripcion: "Instalación y reemplazo de tomacorrientes e interruptores."
            },
            {
                id: "mantenimiento-electrico",
                icono: "fa-screwdriver-wrench",
                titulo: "Mantenimiento eléctrico",
                descripcion: "Revisión preventiva de instalaciones eléctricas del hogar."
            }
        ],

        "Carpintería": [
            {
                id: "muebles-medida",
                icono: "fa-couch",
                titulo: "Muebles a medida",
                descripcion: "Fabricación de muebles personalizados según tus necesidades."
            },
            {
                id: "reparacion-muebles",
                icono: "fa-hammer",
                titulo: "Reparación de muebles",
                descripcion: "Reparación y restauración de muebles de madera."
            },
            {
                id: "instalacion-puertas",
                icono: "fa-door-open",
                titulo: "Instalación de puertas",
                descripcion: "Instalación y ajuste de puertas y estructuras de madera."
            },
            {
                id: "reparacion-cajones",
                icono: "fa-box",
                titulo: "Reparación de cajones",
                descripcion: "Reparación de cajones, bisagras, correderas y otros accesorios."
            }
        ],

        "Pintura": [
            {
                id: "pintura-interior",
                icono: "fa-paint-roller",
                titulo: "Pintura de interiores",
                descripcion: "Pintura profesional para habitaciones, salas y otros ambientes."
            },
            {
                id: "pintura-exterior",
                icono: "fa-house",
                titulo: "Pintura de exteriores",
                descripcion: "Pintura para fachadas, paredes exteriores y otros espacios."
            },
            {
                id: "pintura-habitaciones",
                icono: "fa-bed",
                titulo: "Pintura de habitaciones",
                descripcion: "Renueva tus habitaciones con acabados profesionales."
            },
            {
                id: "acabados-decorativos",
                icono: "fa-palette",
                titulo: "Acabados decorativos",
                descripcion: "Aplicación de acabados y diseños decorativos para tus espacios."
            }
        ],

        "Limpieza": [
            {
                id: "limpieza-profunda",
                icono: "fa-broom",
                titulo: "Limpieza profunda",
                descripcion: "Limpieza detallada de ambientes, superficies y espacios del hogar."
            },
            {
                id: "limpieza-oficinas",
                icono: "fa-building",
                titulo: "Limpieza de oficinas",
                descripcion: "Servicio de limpieza para oficinas y espacios de trabajo."
            },
            {
                id: "limpieza-viviendas",
                icono: "fa-house",
                titulo: "Limpieza de viviendas",
                descripcion: "Limpieza general de casas y departamentos."
            },
            {
                id: "desinfeccion",
                icono: "fa-spray-can-sparkles",
                titulo: "Desinfección",
                descripcion: "Limpieza y desinfección de diferentes ambientes."
            }
        ],

        "Reparaciones": [
            {
                id: "reparacion-general",
                icono: "fa-screwdriver-wrench",
                titulo: "Reparaciones generales",
                descripcion: "Solución de diferentes problemas y desperfectos del hogar."
            },
            {
                id: "reparacion-estructuras",
                icono: "fa-hammer",
                titulo: "Reparación de estructuras",
                descripcion: "Reparación de estructuras y elementos del hogar."
            },
            {
                id: "mantenimiento-hogar",
                icono: "fa-house",
                titulo: "Mantenimiento del hogar",
                descripcion: "Mantenimiento preventivo y correctivo de diferentes espacios."
            },
            {
                id: "reparaciones-diversas",
                icono: "fa-toolbox",
                titulo: "Reparaciones diversas",
                descripcion: "Soluciones para diferentes necesidades de reparación."
            }
        ]

    };


    // Buscar las opciones de la categoría seleccionada
    const serviciosSeleccionados = opciones[servicio];

    if (!serviciosSeleccionados) {

        alert("No se encontraron opciones para este servicio.");

        return;
    }


    // Elementos del HTML
    const contenedor = document.getElementById("opcionesServicio");
    const titulo = document.getElementById("tituloOpciones");
    const lista = document.getElementById("listaOpcionesServicio");


    // Cambiar título
    titulo.textContent = "Servicios de " + servicio;


    // Limpiar opciones anteriores
    lista.innerHTML = "";


    // Crear las tarjetas
    serviciosSeleccionados.forEach(function(opcion) {

        lista.innerHTML += `

            <div class="col-12 col-md-6 col-lg-3">

                <article class="card h-100 shadow-sm">

                    <div class="card-body text-center d-flex flex-column">

                        <div class="icon-box mx-auto mb-3">

                            <i class="fas ${opcion.icono}"></i>

                        </div>

                        <h4 class="fs-5">
                            ${opcion.titulo}
                        </h4>

                        <p class="text-muted small">
                            ${opcion.descripcion}
                        </p>

                        <button
                            type="button"
                            class="btn btn-primary mt-auto"
                            onclick="abrirDetalleServicio('${opcion.id}')"
                        >
                            Ver servicio
                        </button>

                    </div>

                </article>

            </div>

        `;

    });


    // Mostrar el contenedor
    contenedor.style.display = "block";


    // Llevar al usuario hacia las opciones
    contenedor.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

}


// ========================================
// ABRIR DETALLE DEL SERVICIO
// ========================================

function abrirDetalleServicio(servicio) {

    console.log("Servicio específico seleccionado:", servicio);

    window.location.href =
        "detalle-servicio.html?servicio=" + servicio;

}






// ========================================
// FUNCIÓN VER PERFIL
// ========================================

function verPerfil(nombre) {

    if (nombre !== "") {

        alert(
            "Mostrando perfil de " + nombre
        );

    } else {

        alert("No se encontró el trabajador.");

    }
}


// ========================================
// BASE DE DATOS DE TRABAJADORES (SIMULADA)
// ========================================

const trabajadores = [

    // ==============================
    // GASFITERÍA
    // ==============================

    {
        id: 1,
        nombre: "Carlos Mendoza",
        categoria: "gasfiteria",
        zona: "vitarte",
        especialidad: "Reparación de tuberías",
        rating: 4.9,
        trabajos: 36,
        foto: "https://randomuser.me/api/portraits/men/32.jpg",
        precio: 50
    },

    {
        id: 2,
        nombre: "Juan Pérez",
        categoria: "gasfiteria",
        zona: "santa-anita",
        especialidad: "Instalación de grifos",
        rating: 4.7,
        trabajos: 28,
        foto: "https://randomuser.me/api/portraits/men/41.jpg",
        precio: 55
    },

    {
        id: 3,
        nombre: "Roberto Silva",
        categoria: "gasfiteria",
        zona: "ate",
        especialidad: "Mantenimiento general",
        rating: 4.8,
        trabajos: 42,
        foto: "https://randomuser.me/api/portraits/men/52.jpg",
        precio: 50
    },

    {
        id: 4,
        nombre: "Miguel Ángel",
        categoria: "gasfiteria",
        zona: "la-molina",
        especialidad: "Fugas de agua",
        rating: 4.6,
        trabajos: 25,
        foto: "https://randomuser.me/api/portraits/men/61.jpg",
        precio: 60
    },


    // ==============================
    // ELECTRICIDAD
    // ==============================

    {
        id: 5,
        nombre: "José Ramírez",
        categoria: "electricidad",
        zona: "ate",
        especialidad: "Instalaciones eléctricas",
        rating: 4.7,
        trabajos: 42,
        foto: "https://randomuser.me/api/portraits/men/45.jpg",
        precio: 75
    },

    {
        id: 6,
        nombre: "Luis García",
        categoria: "electricidad",
        zona: "vitarte",
        especialidad: "Reparación de circuitos",
        rating: 4.9,
        trabajos: 38,
        foto: "https://randomuser.me/api/portraits/men/68.jpg",
        precio: 70
    },

    {
        id: 7,
        nombre: "Andrés López",
        categoria: "electricidad",
        zona: "la-molina",
        especialidad: "Instalación de paneles",
        rating: 4.8,
        trabajos: 31,
        foto: "https://randomuser.me/api/portraits/men/75.jpg",
        precio: 80
    },

    {
        id: 8,
        nombre: "David Martínez",
        categoria: "electricidad",
        zona: "santa-anita",
        especialidad: "Mantenimiento preventivo",
        rating: 4.5,
        trabajos: 22,
        foto: "https://randomuser.me/api/portraits/men/79.jpg",
        precio: 65
    },


    // ==============================
    // CARPINTERÍA
    // ==============================

    {
        id: 9,
        nombre: "Fernando Castro",
        categoria: "carpinteria",
        zona: "vitarte",
        especialidad: "Muebles a medida",
        rating: 4.9,
        trabajos: 50,
        foto: "https://randomuser.me/api/portraits/men/22.jpg",
        precio: 60
    },

    {
        id: 10,
        nombre: "Oscar Ruiz",
        categoria: "carpinteria",
        zona: "ate",
        especialidad: "Reparación de muebles",
        rating: 4.7,
        trabajos: 35,
        foto: "https://randomuser.me/api/portraits/men/29.jpg",
        precio: 55
    },

    {
        id: 11,
        nombre: "Manuel Flores",
        categoria: "carpinteria",
        zona: "santa-anita",
        especialidad: "Puertas y marcos",
        rating: 4.6,
        trabajos: 28,
        foto: "https://randomuser.me/api/portraits/men/35.jpg",
        precio: 60
    },

    {
        id: 12,
        nombre: "Ernesto Vargas",
        categoria: "carpinteria",
        zona: "la-molina",
        especialidad: "Acabados finos",
        rating: 4.8,
        trabajos: 45,
        foto: "https://randomuser.me/api/portraits/men/55.jpg",
        precio: 65
    },


    // ==============================
    // PINTURA
    // ==============================

    {
        id: 13,
        nombre: "María Torres",
        categoria: "pintura",
        zona: "santa-anita",
        especialidad: "Pintura interior",
        rating: 4.8,
        trabajos: 28,
        foto: "https://randomuser.me/api/portraits/women/44.jpg",
        precio: 40
    },

    {
        id: 14,
        nombre: "Sandra Gómez",
        categoria: "pintura",
        zona: "vitarte",
        especialidad: "Pintura exterior",
        rating: 4.9,
        trabajos: 33,
        foto: "https://randomuser.me/api/portraits/women/32.jpg",
        precio: 42
    },

    {
        id: 15,
        nombre: "Patricia Hernández",
        categoria: "pintura",
        zona: "ate",
        especialidad: "Acabados artísticos",
        rating: 4.7,
        trabajos: 26,
        foto: "https://randomuser.me/api/portraits/women/28.jpg",
        precio: 45
    },

    {
        id: 16,
        nombre: "Rosa Díaz",
        categoria: "pintura",
        zona: "la-molina",
        especialidad: "Decoración y diseño",
        rating: 4.6,
        trabajos: 20,
        foto: "https://randomuser.me/api/portraits/women/51.jpg",
        precio: 50
    },


    // ==============================
    // LIMPIEZA
    // ==============================

    {
        id: 17,
        nombre: "Alejandra Morales",
        categoria: "limpieza",
        zona: "vitarte",
        especialidad: "Limpieza profunda",
        rating: 4.9,
        trabajos: 60,
        foto: "https://randomuser.me/api/portraits/women/65.jpg",
        precio: 35
    },

    {
        id: 18,
        nombre: "Beatriz Campos",
        categoria: "limpieza",
        zona: "ate",
        especialidad: "Limpieza de oficinas",
        rating: 4.8,
        trabajos: 45,
        foto: "https://randomuser.me/api/portraits/women/63.jpg",
        precio: 40
    },

    {
        id: 19,
        nombre: "Carla Rojas",
        categoria: "limpieza",
        zona: "santa-anita",
        especialidad: "Limpieza de viviendas",
        rating: 4.7,
        trabajos: 38,
        foto: "https://randomuser.me/api/portraits/women/68.jpg",
        precio: 35
    },

    {
        id: 20,
        nombre: "Diana Soto",
        categoria: "limpieza",
        zona: "la-molina",
        especialidad: "Desinfección",
        rating: 4.9,
        trabajos: 52,
        foto: "https://randomuser.me/api/portraits/women/71.jpg",
        precio: 45
    },


    // ==============================
    // REPARACIONES
    // ==============================

    {
        id: 21,
        nombre: "Héctor Navarro",
        categoria: "reparaciones",
        zona: "vitarte",
        especialidad: "Reparaciones generales",
        rating: 4.8,
        trabajos: 48,
        foto: "https://randomuser.me/api/portraits/men/77.jpg",
        precio: 55
    },

    {
        id: 22,
        nombre: "Raúl Acosta",
        categoria: "reparaciones",
        zona: "ate",
        especialidad: "Estructuras",
        rating: 4.7,
        trabajos: 32,
        foto: "https://randomuser.me/api/portraits/men/81.jpg",
        precio: 60
    },

    {
        id: 23,
        nombre: "Sergio Fernández",
        categoria: "reparaciones",
        zona: "santa-anita",
        especialidad: "Mantenimiento del hogar",
        rating: 4.9,
        trabajos: 55,
        foto: "https://randomuser.me/api/portraits/men/83.jpg",
        precio: 50
    },

    {
        id: 24,
        nombre: "Tomás Mendez",
        categoria: "reparaciones",
        zona: "la-molina",
        especialidad: "Reparaciones diversas",
        rating: 4.6,
        trabajos: 24,
        foto: "https://randomuser.me/api/portraits/men/86.jpg",
        precio: 65
    }

];


// ========================================
// FUNCIÓN PARA CREAR TARJETA DE TRABAJADOR
// ========================================

function crearTarjetaTrabajador(trabajador) {
    return `
        <div class="col-12 col-md-6 col-lg-4">
            <article class="card h-100 shadow-sm">
                <img
                    src="${trabajador.foto}"
                    class="card-img-top"
                    alt="${trabajador.nombre}"
                >
                <div class="card-body d-flex flex-column">
                    <span class="badge text-bg-info align-self-start mb-3">Disponible</span>
                    <h3 class="h4 card-title">${trabajador.nombre}</h3>
                    <p class="card-text text-muted small">
                        ${trabajador.especialidad}
                    </p>
                    <div class="mb-3 mt-2 text-dark service-info">
                        <div class="d-flex justify-content-between border-bottom pb-2 mb-2">
                            <span class="info-label">Precio base:</span>
                            <strong class="info-value">S/ ${trabajador.precio}.00</strong>
                        </div>
                        <div class="d-flex justify-content-between pt-1">
                            <span class="info-label">Rating:</span>
                            <strong class="info-value">★ ${trabajador.rating}</strong>
                        </div>
                    </div>
                    <p class="text-muted small mb-3">
                        <i class="fas fa-briefcase"></i> ${trabajador.trabajos} trabajos realizados
                    </p>
                    <div class="mt-auto d-flex gap-2 flex-wrap">
                        <button
                            type="button"
                            class="btn btn-sm btn-outline-primary flex-grow-1"
                            data-bs-toggle="popover"
                            data-bs-title="${trabajador.nombre}"
                            data-bs-content="Especialista en ${trabajador.especialidad}. Calificación: ${trabajador.rating}/5. Contáctalo para más información."
                        >
                            Información
                        </button>
                        <button
                            class="btn btn-sm btn-primary flex-grow-1"
                            onclick="contratarTrabajador('${trabajador.nombre}', '${trabajador.categoria}')"
                        >
                            Contratar
                        </button>
                    </div>
                </div>
            </article>
        </div>
    `;
}


// ========================================
// FUNCIÓN PARA CONTRATAR TRABAJADOR
// ========================================

function contratarTrabajador(nombre, categoria) {
    alert(`¡Excelente! Has seleccionado a ${nombre} para ${categoria.replace('-', ' ')}.`);
}


// ========================================
// BUSCAR SERVICIOS
// ========================================

document
    .getElementById("busquedaForm")
    .addEventListener("submit", function(event) {

        event.preventDefault();

        const categoria =
            document.getElementById("categoria").value;

        const zona =
            document.getElementById("zona").value;


        if (categoria === "" || zona === "") {

            mensajeBusqueda.innerHTML =
                '<div class="alert alert-warning">' +
                '<i class="fas fa-info-circle"></i> Selecciona una categoría y una zona.' +
                '</div>';

        } else {

            // Filtrar trabajadores por categoría y zona
            const resultados = trabajadores.filter(t => 
                t.categoria === categoria && t.zona === zona
            );

            const modalContenido = document.getElementById("modalResultadosContenido");

            if (resultados.length > 0) {

                let html = '<div class="alert alert-success mb-4">' +
                    '<i class="fas fa-check-circle"></i> Se encontraron <strong>' + resultados.length + 
                    '</strong> trabajador(es) disponible(s).' +
                    '</div>';

                html += '<div class="row g-4">';

                resultados.forEach(trabajador => {
                    html += crearTarjetaTrabajador(trabajador);
                });

                html += '</div>';

                modalContenido.innerHTML = html;

                // Reinicializar popovers
                const popoverTriggerList = [].slice.call(
                    modalContenido.querySelectorAll('[data-bs-toggle="popover"]')
                );
                popoverTriggerList.map(function (popoverTriggerEl) {
                    return new bootstrap.Popover(popoverTriggerEl);
                });

                // Mostrar el modal
                const modal = new bootstrap.Modal(document.getElementById('resultadosBusquedaModal'));
                modal.show();

                // Mostrar mensaje de éxito en la caja de búsqueda también
                mensajeBusqueda.innerHTML =
                    '<div class="alert alert-success">' +
                    '<i class="fas fa-check-circle"></i> ¡Búsqueda completada! Revisa para ver los resultados.' +
                    '</div>';

                console.log("Búsqueda exitosa:", resultados.length, "trabajadores encontrados");

            } else {

                modalContenido.innerHTML = 
                    '<div class="alert alert-danger">' +
                    '<i class="fas fa-times-circle"></i> No hay trabajadores disponibles en <strong>' + 
                    zona.replace('-', ' ') + '</strong> para <strong>' + 
                    categoria.replace('-', ' ') + '</strong>. Intenta con otra búsqueda.' +
                    '</div>';

                // Mostrar el modal con el mensaje de error
                const modal = new bootstrap.Modal(document.getElementById('resultadosBusquedaModal'));
                modal.show();

                mensajeBusqueda.innerHTML =
                    '<div class="alert alert-danger">' +
                    '<i class="fas fa-times-circle"></i> Sin resultados disponibles.' +
                    '</div>';

                console.log("No se encontraron resultados para:", categoria, zona);
            }
        }

    });


// ========================================
// VALIDACIÓN DEL FORMULARIO
// ========================================

const solicitudForm =
    document.getElementById("solicitudForm");

let solicitudIntentada = false;

solicitudForm.addEventListener(
    "submit",
    function(event) {

        event.preventDefault();
        solicitudIntentada = true;

        if (!solicitudForm.checkValidity()) {

            event.stopPropagation();
            solicitudForm.classList.add("was-validated");

            mensajeSolicitud.innerHTML =
                '<div class="alert alert-danger">' +
                '<i class="fas fa-exclamation-circle"></i> ' +
                'Revisa los campos obligatorios.' +
                '</div>';

        } else {

            try {

                const presupuesto =
                    document.getElementById("presupuesto").value;

                if (presupuesto <= 0) {

                    throw new Error(
                        "El presupuesto debe ser mayor que cero."
                    );

                }

                mensajeSolicitud.innerHTML =
                    '<div class="alert alert-success">' +
                    '<i class="fas fa-check-circle"></i> ' +
                    'Solicitud publicada correctamente.' +
                    '</div>';

                console.log(
                    "Solicitud publicada"
                );

            } catch (error) {

                solicitudForm.classList.add("was-validated");

                mensajeSolicitud.innerHTML =
                    '<div class="alert alert-danger">' +
                    '<i class="fas fa-exclamation-circle"></i> ' +
                    error.message +
                    '</div>';

                console.error(error);
            }
        }

    }
);

// Limpiar el formulario manualmente
const limpiarBtn = solicitudForm.querySelector('button[type="reset"]');
limpiarBtn.addEventListener('click', function() {
    solicitudForm.reset();
    solicitudForm.classList.remove("was-validated");
    mensajeSolicitud.innerHTML = "";
    solicitudIntentada = false;
});


// ========================================
// LOGIN
// ========================================

const loginForm = document.getElementById("loginForm");
const correoInput = document.getElementById("correo");
const passwordInput = document.getElementById("password");
const loginModal = bootstrap.Modal.getInstance(document.getElementById('loginModal')) || new bootstrap.Modal(document.getElementById('loginModal'));
let loginIntentado = false;

// Expresión regular para validar correo
const regexCorreo = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Función para validar campos en tiempo real
function validarCamposEnTiempoReal() {
    if (loginIntentado) {
        // Validar correo
        if (regexCorreo.test(correoInput.value)) {
            correoInput.classList.remove("is-invalid");
            correoInput.classList.add("is-valid");
        } else if (correoInput.value !== "") {
            correoInput.classList.add("is-invalid");
            correoInput.classList.remove("is-valid");
        }

        // Validar contraseña
        if (passwordInput.value.length >= 6) {
            passwordInput.classList.remove("is-invalid");
            passwordInput.classList.add("is-valid");
        } else if (passwordInput.value !== "") {
            passwordInput.classList.add("is-invalid");
            passwordInput.classList.remove("is-valid");
        }
    }
}

// Agregar listeners para validación en tiempo real
correoInput.addEventListener("input", validarCamposEnTiempoReal);
passwordInput.addEventListener("input", validarCamposEnTiempoReal);

// Evento principal del formulario
loginForm.addEventListener("submit", function(event) {

    event.preventDefault();

    const correo = correoInput.value;
    const password = passwordInput.value;

    let esValido = true;
    loginIntentado = true;

    // Validar correo
    if (!regexCorreo.test(correo)) {
        correoInput.classList.add("is-invalid");
        correoInput.classList.remove("is-valid");
        esValido = false;
    } else {
        correoInput.classList.remove("is-invalid");
        correoInput.classList.add("is-valid");
    }

    // Validar contraseña (mínimo 6 caracteres)
    if (password.length < 6) {
        passwordInput.classList.add("is-invalid");
        passwordInput.classList.remove("is-valid");
        esValido = false;
    } else {
        passwordInput.classList.remove("is-invalid");
        passwordInput.classList.add("is-valid");
    }

    if (esValido) {

        const tipoUsuario = document.querySelector(
            'input[name="tipoUsuario"]:checked'
        ).value;

        mensajeLogin.innerHTML =
            '<div class="alert alert-success">' +
            '<i class="fas fa-check-circle"></i> ' +
            'Inicio de sesión validado correctamente. ' +
            '<br><small>Usuario: ' + tipoUsuario + '</small>' +
            '</div>';

        console.log(
            "Login exitoso - Correo:",
            correo,
            "Tipo:",
            tipoUsuario
        );

        // Limpiar después de 2 segundos
        setTimeout(function() {
            loginForm.reset();
            correoInput.classList.remove("is-valid", "is-invalid");
            passwordInput.classList.remove("is-valid", "is-invalid");
            mensajeLogin.innerHTML = "";
            loginIntentado = false;
            // Cerrar el modal
            loginModal.hide();
        }, 2000);

    } else {

        mensajeLogin.innerHTML =
            '<div class="alert alert-danger">' +
            '<i class="fas fa-exclamation-circle"></i> ' +
            'Por favor revisa los campos. El correo debe ser válido y la contraseña mínimo 6 caracteres.' +
            '</div>';

        console.error("Validación fallida");

    }

});


// ========================================
// FOREACH
// ========================================

const servicios = [
    "Gasfitería",
    "Electricidad",
    "Carpintería",
    "Pintura",
    "Limpieza"
];

servicios.forEach(function(servicio) {

    console.log(
        "Servicio disponible:",
        servicio
    );

});