// ============================================
// CONFIGURACIÓN GLOBAL
// ============================================
const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbxIipuPmVAvaTt7_oUQzMLNtXIah19dcq2CWkaoglQvFivqY-wBYEw64tvUmL4-1k62/exec";
const REMITENTES_URL = "https://script.google.com/macros/s/AKfycbxIipuPmVAvaTt7_oUQzMLNtXIah19dcq2CWkaoglQvFivqY-wBYEw64tvUmL4-1k62/exec?action=getRemitentes";
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxIipuPmVAvaTt7_oUQzMLNtXIah19dcq2CWkaoglQvFivqY-wBYEw64tvUmL4-1k62/exec";

// Variables globales
let barriosData = [];
let remitentesData = [];
let usuariosDisponibles = [];
let currentFocus = -1;
let filteredBarrios = [];
let closeBarrioDropdownTimeout = null;
let dropdownJustClicked = false;
let timeoutBusqueda = null;
let formularioEnviandose = false;

// Variables para precios por ciudad
const PRECIOS_CIUDAD = {
    "Bogotá D.C.": 10000,
    "Soacha": 12000
};

// Elementos del DOM
let formaPagoInput, valorRecaudarInput, autoRecaudoLabel, valorRecaudarHelp;
let paymentOptions, barrioInput, barrioIdInput, autocompleteDropdown;
let remitenteInput, remitenteDropdown;
let resumenFormaPago, resumenValorRecaudar, resumenEstado;
let submitButton, submitText, submitIcon;
// ============================================
// GOOGLE PLACES AUTOCOMPLETE - COMPLETO CON COORDENADAS
// ============================================

function inicializarGooglePlacesAutocomplete() {
    console.log("📍 Inicializando Google Places Autocomplete...");
    
    const direccionInput = document.getElementById('direccionDestino');
    
    if (!direccionInput) {
        console.error("❌ No se encontró el campo 'direccionDestino'");
        return;
    }
    
    // Verificar si Google Maps está disponible
    if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
        console.warn("⚠️ Google Places API no está disponible. Verifica tu API Key.");
        mostrarErrorGoogleMaps();
        return;
    }
    
    try {
        // Área más específica para Bogotá + Soacha
        const bogotaSoachaBounds = new google.maps.LatLngBounds(
            new google.maps.LatLng(4.48, -74.25),  // Soacha
            new google.maps.LatLng(4.85, -74.00)   // Bogotá norte
        );
        
        const autocomplete = new google.maps.places.Autocomplete(direccionInput, {
            componentRestrictions: { 
                country: 'co'
            },
            bounds: bogotaSoachaBounds,
            strictBounds: true,  // ← ¡SOLO resultados dentro del área!
            fields: [
                'address_components', 
                'formatted_address', 
                'geometry',
                'name'
            ]
        });
        
        // Deshabilitar el autocomplete nativo del navegador
        direccionInput.setAttribute('autocomplete', 'off');
        
        // ============================================
        // 🔥 NUEVO: CREAR CAMPOS OCULTOS PARA COORDENADAS
        // ============================================
        function crearCamposCoordenadasSiNoExisten() {
            let form = document.querySelector('form');
            if (!form) {
                console.warn('⚠️ No se encontró formulario para agregar campos de coordenadas');
                return;
            }
            
            // Crear campo para latitud si no existe
            if (!document.getElementById('latitud')) {
                const latField = document.createElement('input');
                latField.type = 'hidden';
                latField.id = 'latitud';
                latField.name = 'latitud';
                latField.value = '';
                form.appendChild(latField);
                console.log('✅ Campo oculto "latitud" creado');
            }
            
            // Crear campo para longitud si no existe
            if (!document.getElementById('longitud')) {
                const lngField = document.createElement('input');
                lngField.type = 'hidden';
                lngField.id = 'longitud';
                lngField.name = 'longitud';
                lngField.value = '';
                form.appendChild(lngField);
                console.log('✅ Campo oculto "longitud" creado');
            }
        }
        
        // Crear campos ocultos al inicializar
        crearCamposCoordenadasSiNoExisten();
        
        // ============================================
        // CONFIGURAR EVENTO CUANDO SE SELECCIONA UNA DIRECCIÓN
        // ============================================
        autocomplete.addListener('place_changed', function() {
            const place = autocomplete.getPlace();
            
            if (!place.geometry) {
                console.log("❌ No se seleccionó un lugar válido");
                return;
            }
            
            console.log("✅ Dirección Google seleccionada:", place.formatted_address);
            
            // OBTENER COORDENADAS
            const latitud = place.geometry.location.lat();
            const longitud = place.geometry.location.lng();
            
            console.log("🎯 Coordenadas obtenidas:", {
                latitud: latitud,
                longitud: longitud
            });
            
            // Guardar datos para posible uso futuro
            window.ultimaDireccionSeleccionada = {
                direccion_completa: place.formatted_address,
                latitud: latitud,
                longitud: longitud,
                nombre_lugar: place.name || ''
            };
            
            // ============================================
            // 🔥 NUEVO: GUARDAR COORDENADAS EN CAMPOS OCULTOS
            // ============================================
            const latField = document.getElementById('latitud');
            const lngField = document.getElementById('longitud');
            
            if (latField && lngField) {
                latField.value = latitud;
                lngField.value = longitud;
                console.log('✅ Coordenadas guardadas en campos ocultos');
                
                // Mostrar en consola para verificación
                console.log('📋 Valores actuales:', {
                    'campo latitud.value': latField.value,
                    'campo longitud.value': lngField.value,
                    'campo latitud.name': latField.name,
                    'campo longitud.name': lngField.name
                });
            } else {
                console.error('❌ Campos ocultos no encontrados. Creándolos...');
                crearCamposCoordenadasSiNoExisten();
                
                // Intentar asignar valores nuevamente
                const latFieldNew = document.getElementById('latitud');
                const lngFieldNew = document.getElementById('longitud');
                if (latFieldNew && lngFieldNew) {
                    latFieldNew.value = latitud;
                    lngFieldNew.value = longitud;
                }
            }
            
            // ============================================
            // EXTRAER COMPONENTES DE LA DIRECCIÓN (Tu código original)
            // ============================================
            place.address_components.forEach(component => {
                const tipos = component.types;
                
                // Barrio
                if (tipos.includes('neighborhood') || tipos.includes('sublocality_level_1')) {
                    const barrioInput = document.getElementById('barrioLocalidad');
                    if (barrioInput && (!barrioInput.value.trim())) {
                        barrioInput.value = component.long_name;
                        barrioInput.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                }
                
                // Ciudad
                if (tipos.includes('locality')) {
                    const ciudadSelect = document.getElementById('ciudadDestino');
                    if (ciudadSelect) {
                        const ciudadEncontrada = component.long_name.toLowerCase();
                        
                        // Buscar coincidencia en las opciones
                        Array.from(ciudadSelect.options).forEach(option => {
                            if (option.value && option.value.toLowerCase().includes(ciudadEncontrada)) {
                                ciudadSelect.value = option.value;
                                ciudadSelect.dispatchEvent(new Event('change', { bubbles: true }));
                                console.log(`✅ Ciudad auto-seleccionada: ${option.value}`);
                            }
                        });
                    }
                }
            });
            
            // Mostrar notificación con coordenadas
            mostrarNotificacionDireccion(place.formatted_address, latitud, longitud);
            
            // Enfocar el siguiente campo automáticamente
            setTimeout(() => {
                const complementoInput = document.getElementById('complementoDireccion');
                if (complementoInput) {
                    complementoInput.focus();
                }
            }, 500);
        });
        
        // Prevenir submit del formulario al presionar Enter
        direccionInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && document.activeElement === direccionInput) {
                e.preventDefault();
                if (this.value.length > 3) {
                    this.blur();
                    setTimeout(() => this.focus(), 10);
                }
            }
        });
        
        console.log("✅ Google Places Autocomplete inicializado exitosamente");
        
    } catch (error) {
        console.error("❌ Error inicializando Google Places:", error);
        mostrarErrorGoogleMaps();
    }
}

// ============================================
// FUNCIÓN MEJORADA DE NOTIFICACIÓN CON COORDENADAS
// ============================================
function mostrarNotificacionDireccion(direccion, latitud, longitud) {
    // Crear notificación flotante
    const notificacion = document.createElement('div');
    notificacion.className = 'fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-lg shadow-xl z-50 flex items-center gap-3 animate-slideUp';
    notificacion.style.cssText = `
        animation: slideUp 0.3s ease-out forwards;
        max-width: 90%;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    `;
    
    let texto = `📍 Dirección encontrada: ${direccion.substring(0, 40)}${direccion.length > 40 ? '...' : ''}`;
    
    if (latitud && longitud) {
        texto += `<br><small class="opacity-80">Coordenadas: ${latitud.toFixed(6)}, ${longitud.toFixed(6)}</small>`;
    }
    
    notificacion.innerHTML = `
        <span class="material-symbols-outlined text-lg">check_circle</span>
        <div class="text-sm font-medium">${texto}</div>
    `;
    
    document.body.appendChild(notificacion);
    
    // Eliminar después de 4 segundos
    setTimeout(() => {
        notificacion.style.animation = 'slideDown 0.3s ease-in forwards';
        setTimeout(() => {
            if (notificacion.parentElement) notificacion.remove();
        }, 300);
    }, 4000);
}

// ============================================
// FUNCIÓN PARA VERIFICAR CAMPOS DE COORDENADAS
// ============================================
function verificarCamposCoordenadas() {
    console.log('🔍 Verificando campos de coordenadas...');
    
    const campos = [
        { id: 'latitud', name: 'latitud', value: document.getElementById('latitud')?.value },
        { id: 'longitud', name: 'longitud', value: document.getElementById('longitud')?.value }
    ];
    
    campos.forEach(campo => {
        if (document.getElementById(campo.id)) {
            console.log(`✅ Campo "${campo.id}" encontrado. Valor: "${campo.value}"`);
        } else {
            console.log(`❌ Campo "${campo.id}" NO encontrado`);
        }
    });
}

// ============================================
// AGREGAR ESTA FUNCIÓN AL EVENTO DE ENVÍO DEL FORMULARIO
// ============================================
function agregarVerificacionCoordenadasAlFormulario() {
    const formulario = document.querySelector('form');
    if (formulario) {
        formulario.addEventListener('submit', function(e) {
            console.log('📤 FORMULARIO ENVIÁNDOSE - VERIFICANDO COORDENADAS');
            
            // Verificar campos de coordenadas
            const latitud = document.getElementById('latitud')?.value;
            const longitud = document.getElementById('longitud')?.value;
            
            console.log('📊 Datos de coordenadas a enviar:', {
                latitud: latitud,
                longitud: longitud,
                tieneLatitud: !!latitud,
                tieneLongitud: !!longitud
            });
            
            // Mostrar todos los datos del formulario para depuración
            const formData = new FormData(formulario);
            console.log('📝 Todos los datos del formulario:');
            for (let [key, value] of formData.entries()) {
                console.log(`  ${key}: ${value}`);
            }
        });
    }
}

// ============================================
// INICIALIZACIÓN COMPLETA
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    // Inicializar autocomplete
    inicializarGooglePlacesAutocomplete();
    
    // Agregar animaciones CSS
    agregarAnimacionesCSS();
    
    // Agregar verificación al formulario (opcional, para debug)
    setTimeout(() => {
        agregarVerificacionCoordenadasAlFormulario();
        console.log('🔄 Sistema de coordenadas listo');
    }, 1000);
});

function mostrarErrorGoogleMaps() {
    const direccionInput = document.getElementById('direccionDestino');
    if (direccionInput) {
        // Verificar si ya hay un mensaje de error
        const existingError = direccionInput.parentNode.querySelector('.google-maps-error');
        if (!existingError) {
            const errorMsg = document.createElement('div');
            errorMsg.className = 'google-maps-error text-xs text-orange-600 dark:text-orange-400 mt-1 flex items-center gap-1';
            errorMsg.innerHTML = `
                <span class="material-symbols-outlined text-sm">warning</span>
                <span>Google Maps no disponible. Escribe la dirección manualmente.</span>
            `;
            
            direccionInput.parentNode.appendChild(errorMsg);
            
            // Eliminar después de 10 segundos
            setTimeout(() => {
                if (errorMsg.parentElement) errorMsg.remove();
            }, 10000);
        }
    }
}

// Añadir animaciones CSS dinámicamente
function agregarAnimacionesCSS() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translate(-50%, 20px);
            }
            to {
                opacity: 1;
                transform: translate(-50%, 0);
            }
        }
        
        @keyframes slideDown {
            from {
                opacity: 1;
                transform: translate(-50%, 0);
            }
            to {
                opacity: 0;
                transform: translate(-50%, 20px);
            }
        }
        
        .animate-slideUp {
            animation: slideUp 0.3s ease-out forwards;
        }
        
        /* Estilos para el autocomplete de Google */
        .pac-container {
            z-index: 10002 !important;
            border-radius: 8px !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
            border: 1px solid #e5e7eb !important;
            margin-top: 4px !important;
        }
        
        .pac-item {
            padding: 8px 12px !important;
            cursor: pointer !important;
            border-bottom: 1px solid #f3f4f6 !important;
            font-size: 14px !important;
        }
        
        .pac-item:hover {
            background-color: #f9fafb !important;
        }
        
        .pac-item-selected {
            background-color: #eff6ff !important;
        }
        
        .pac-icon {
            margin-right: 8px !important;
        }
        
        @media (max-width: 767px) {
            .pac-container {
                position: fixed !important;
                top: auto !important;
                bottom: 0 !important;
                left: 0 !important;
                right: 0 !important;
                width: 100vw !important;
                max-height: 50vh !important;
                border-radius: 12px 12px 0 0 !important;
            }
        }
    `;
    document.head.appendChild(style);
}

// ============================================
// FUNCIÓN PRINCIPAL DE INICIALIZACIÓN
// ============================================

function initApp() {
    console.log('🚀 Inicializando aplicación...');
    
    initializeDOMElements();
    
   loadBarriosData().then(() => {
        loadRemitentesData();
        loadUsuariosParaAutocomplete().then(() => {
            setupEventListeners();
            initializeUI();
            
            // ========== INICIALIZAR GOOGLE PLACES AQUÍ ==========
            // Esperar un poco para asegurar que Google Maps API esté cargada
            setTimeout(() => {
                console.log('🌍 Verificando Google Maps API...');
                
                if (typeof google !== 'undefined' && google.maps && google.maps.places) {
                    console.log('✅ Google Maps API disponible');
                    try {
                        inicializarGooglePlacesAutocomplete();
                        console.log('🎯 Google Places Autocomplete inicializado');
                    } catch (error) {
                        console.error('❌ Error inicializando Google Places:', error);
                        mostrarErrorGoogleMaps();
                    }
                } else {
                    console.warn('⚠️ Google Maps API no está disponible todavía');
                    // Intentar de nuevo después de 2 segundos
                    setTimeout(() => {
                        if (typeof google !== 'undefined' && google.maps) {
                            inicializarGooglePlacesAutocomplete();
                        } else {
                            mostrarErrorGoogleMaps();
                        }
                    }, 2000);
                }
            }, 1000); // Aumentado a 1 segundo
            // ========== FIN DE GOOGLE PLACES ==========
            
            console.log('✅ Aplicación inicializada');
        });
    }).catch(error => {
        console.error('❌ Error inicializando:', error);
        loadRemitentesData();
        setupEventListeners();
        initializeUI();
    });
}

// ============================================
// FUNCIONES DE INICIALIZACIÓN DEL DOM
// ============================================

function initializeDOMElements() {
    console.log('🔍 Inicializando elementos DOM...');
    
    formaPagoInput = document.getElementById('formaPago');
    valorRecaudarInput = document.getElementById('valorRecaudar');
    autoRecaudoLabel = document.getElementById('autoRecaudoLabel');
    valorRecaudarHelp = document.getElementById('valorRecaudarHelp');
    paymentOptions = document.querySelectorAll('.payment-option');
    barrioInput = document.getElementById('barrioLocalidad');
    barrioIdInput = document.getElementById('barrioId');
    autocompleteDropdown = document.getElementById('autocompleteDropdown');
    resumenFormaPago = document.getElementById('resumenFormaPago');
    resumenValorRecaudar = document.getElementById('resumenValorRecaudar');
    resumenEstado = document.getElementById('resumenEstado');
    submitButton = document.getElementById('submitButton');
    submitText = document.getElementById('submitText');
    submitIcon = document.getElementById('submitIcon');
    
    remitenteInput = document.getElementById('remitente');
    remitenteDropdown = document.getElementById('remitenteAutocomplete');
    
    console.log('📍 Campo barrio:', barrioInput ? '✅' : '❌');
    console.log('📍 Dropdown barrio:', autocompleteDropdown ? '✅' : '❌');
}

// ============================================
// FUNCIONES PARA CARGA DE DATOS
// ============================================

function loadBarriosData() {
    console.log('📂 Cargando datos de barrios...');
    
    return fetch('barrios.json')
        .then(response => {
            if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
            return response.json();
        })
        .then(data => {
            barriosData = data;
            window.barriosData = data;
            console.log(`✅ Cargados ${barriosData.length} barrios`);
            return data;
        })
        .catch(error => {
            console.error('❌ Error cargando barrios:', error);
            barriosData = getDefaultBarrios();
            window.barriosData = barriosData;
            return barriosData;
        });
}

function loadRemitentesData() {
    console.log('📂 Cargando datos de remitentes...');
    
    return fetch(REMITENTES_URL)
        .then(response => response.json())
        .then(data => {
            remitentesData = data;
            console.log(`✅ Cargados ${remitentesData.length} remitentes`);
            return data;
        })
        .catch(error => {
            console.error('❌ Error cargando remitentes:', error);
            remitentesData = [];
            return [];
        });
}

async function loadUsuariosParaAutocomplete() {
    try {
        console.log("🔄 Cargando usuarios para autocomplete...");
        const response = await fetch("usuarios.json?v=" + Date.now());
        const usuarios = await response.json();
        
        console.log(`✅ ${usuarios.length} usuarios cargados desde JSON`);
        
        // Filtrar solo clientes activos
        usuariosDisponibles = usuarios.filter(u => 
            u.ESTADO === "ACTIVO" && 
            u.ROL === "CLIENTE" &&
            (u["NOMBRE REMITENTE"] || u["NOMBRE COMPLETO"])
        );
        
        // Hacerlo global para depuración
        window.usuariosDisponibles = usuariosDisponibles;
        
        console.log(`📊 ${usuariosDisponibles.length} usuarios disponibles para autocomplete`);
        
        // Mostrar detalles de los usuarios disponibles
        usuariosDisponibles.forEach((usuario, index) => {
            console.log(`   ${index + 1}. ${usuario["NOMBRE REMITENTE"] || usuario["NOMBRE COMPLETO"]} - Tel: ${usuario["TELEFONO REMITENTE"] || usuario.TELEFONO}`);
        });
        
        return usuariosDisponibles;
        
    } catch (error) {
        console.error("❌ Error cargando usuarios para autocomplete:", error);
        usuariosDisponibles = [];
        window.usuariosDisponibles = [];
        return [];
    }
}

// ============================================
// VERIFICACIÓN DE AUTENTICACIÓN Y SESIÓN
// ============================================

function verificarSesionYConfigurarUI() {
    console.log("🔐 Verificando autenticación...");
    
    const usuario = JSON.parse(localStorage.getItem("usuarioLogueado"));
    const loadingScreen = document.getElementById('loadingScreen');
    const mainContent = document.getElementById('mainContent');
    
    if (!usuario) {
        setTimeout(() => {
            alert("Debes iniciar sesión para acceder a esta página");
            window.location.href = "login.html";
        }, 1000);
        return false;
    }
    
    // Verificar que el usuario esté activo
    if (usuario.ESTADO !== "ACTIVO") {
        console.log("⚠️ Usuario inactivo, cerrando sesión...");
        localStorage.removeItem("usuarioLogueado");
        window.location.replace("login.html");
        return false;
    }
    
    // Si hay usuario, mostrar contenido principal
    setTimeout(() => {
        if (loadingScreen) loadingScreen.style.display = 'none';
        if (mainContent) mainContent.classList.remove('hidden');
        
        // Actualizar información del usuario en la interfaz
        const nombreUsuario = document.getElementById('nombreUsuario');
        const rolUsuario = document.getElementById('rolUsuario');
        
        if (nombreUsuario) {
            nombreUsuario.textContent = usuario["NOMBRE COMPLETO"] || usuario["NOMBRE"] || "Usuario";
        }
        
        if (rolUsuario) {
            rolUsuario.textContent = usuario.ROL === "CLIENTE" ? "Cliente" : 
                                   usuario.ROL === "ADMIN" ? "Administrador" : 
                                   usuario.ROL === "OPERADOR" ? "Operador Logístico" : 
                                   "Usuario";
        }
        
        // Configurar campos ocultos para TODOS los usuarios
        const correoRemitente = document.getElementById('correoRemitente');
        const usuarioIdField = document.getElementById('usuarioId');
        
        if (usuario) {
            // Siempre enviar correo y usuario ID
            if (correoRemitente) {
                correoRemitente.value = usuario["CORREO ELECTRONICO"] || usuario["CORREO"] || "";
            }
            
            if (usuarioIdField) {
                usuarioIdField.value = usuario["USUARIO"] || usuario["ID"] || "";
            }
        }
        
        // Configurar campos según rol de usuario
        configurarCamposSegunRol(usuario);
        
        // Inicializar temporizador de inactividad
        configurarTemporizadorInactividad();
        
    }, 1000);
    
    return true;
}

function configurarCamposSegunRol(usuario) {
    // Si es cliente, prellenar campos del remitente y hacerlos de solo lectura
    if (usuario.ROL === "CLIENTE") {
        const remitente = document.getElementById('remitente');
        const direccionRemitente = document.getElementById('direccionRemitente');
        const telefonoRemitente = document.getElementById('telefonoRemitente');
        const iconRemitente = document.getElementById('iconRemitente');
        const iconTelefonoRemitente = document.getElementById('iconTelefonoRemitente');
        const iconDireccionRemitente = document.getElementById('iconDireccionRemitente');
        
        if (remitente) {
            remitente.value = usuario["NOMBRE REMITENTE"] || usuario["NOMBRE COMPLETO"] || "";
            remitente.setAttribute('readonly', 'true');
            remitente.classList.add('cliente-readonly');
            if (iconRemitente) iconRemitente.textContent = 'lock';
        }
        
        if (direccionRemitente) {
            direccionRemitente.value = usuario["DIRECCION REMITENTE"] || "";
            direccionRemitente.setAttribute('readonly', 'true');
            direccionRemitente.classList.add('cliente-readonly');
            if (iconDireccionRemitente) iconDireccionRemitente.textContent = 'lock';
        }
        
        if (telefonoRemitente) {
            telefonoRemitente.value = usuario["TELEFONO REMITENTE"] || usuario["TELEFONO"] || "";
            telefonoRemitente.setAttribute('readonly', 'true');
            telefonoRemitente.classList.add('cliente-readonly');
            if (iconTelefonoRemitente) iconTelefonoRemitente.textContent = 'lock';
        }
        
        // Añadir indicadores visuales de que son campos fijos
        const labelRemitente = document.getElementById('labelRemitente');
        const labelTelefonoRemitente = document.getElementById('labelTelefonoRemitente');
        const labelDireccionRemitente = document.getElementById('labelDireccionRemitente');
        
        if (labelRemitente) {
            labelRemitente.classList.add('campo-cliente-fijo');
            labelRemitente.innerHTML = 'Nombre Completo / Empresa <span class="text-xs text-gray-500">(Fijo para cliente)</span>';
        }
        if (labelTelefonoRemitente) {
            labelTelefonoRemitente.classList.add('campo-cliente-fijo');
            labelTelefonoRemitente.innerHTML = 'Teléfono de Contacto <span class="text-xs text-gray-500">(Fijo para cliente)</span>';
        }
        if (labelDireccionRemitente) {
            labelDireccionRemitente.classList.add('campo-cliente-fijo');
            labelDireccionRemitente.innerHTML = 'Dirección de Recogida <span class="text-xs text-gray-500">(Fijo para cliente)</span>';
        }
        
        // Ocultar el autocomplete para clientes
        const dropdown = document.getElementById('remitenteAutocomplete');
        if (dropdown) {
            dropdown.style.display = 'none';
        }
    } else {
        // Si NO es cliente (ADMIN u OPERADOR), los campos son editables
        const remitente = document.getElementById('remitente');
        const iconRemitente = document.getElementById('iconRemitente');
        
        if (remitente) {
            remitente.removeAttribute('readonly');
            remitente.classList.remove('cliente-readonly');
            remitente.placeholder = "Ej. Distribuidora Central S.A.";
            if (iconRemitente) iconRemitente.textContent = 'search';
            
            // Asegurarnos de que los usuarios estén cargados antes de inicializar
            setTimeout(() => {
                if (usuariosDisponibles && usuariosDisponibles.length > 0) {
                    console.log(`🎯 Inicializando autocomplete con ${usuariosDisponibles.length} usuarios`);
                    inicializarAutocompleteRemitente();
                } else {
                    console.log("🔄 Usuarios no cargados, cargando ahora...");
                    loadUsuariosParaAutocomplete().then(() => {
                        if (usuariosDisponibles.length > 0) {
                            inicializarAutocompleteRemitente();
                        }
                    });
                }
            }, 1000);
        }
    }
}

function configurarTemporizadorInactividad() {
    let tiempoInactividad = 30 * 60 * 1000; // 30 minutos
    
    function reiniciarTemporizador() {
        if (window.tiempoInactivo) {
            clearTimeout(window.tiempoInactivo);
        }
        
        window.tiempoInactivo = setTimeout(() => {
            alert("Sesión expirada por inactividad");
            localStorage.removeItem("usuarioLogueado");
            window.location.replace("login.html");
        }, tiempoInactividad);
    }
    
    // Reiniciar temporizador en eventos de usuario
    ['click', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(evento => {
        document.addEventListener(evento, reiniciarTemporizador);
    });
    
    // Iniciar temporizador
    reiniciarTemporizador();
}

// ============================================
// FUNCIONES PARA AUTOCOMPLETE DE BARRIOS
// ============================================

function handleBarrioInput() {
    const searchText = this.value.trim();
    console.log(`🔍 Buscando barrio: "${searchText}"`);
    
    if (searchText === '') {
        if (barrioIdInput) barrioIdInput.value = '';
        hideDropdown();
        return;
    }
    
    if (searchText.length >= 1) {
        filteredBarrios = filterBarrios(searchText);
        console.log(`✅ ${filteredBarrios.length} resultados`);
        
        if (filteredBarrios.length > 0) {
            showAutocomplete(filteredBarrios);
        } else {
            showAutocomplete([]);
        }
    } else {
        hideDropdown();
        currentFocus = -1;
    }
}

function filterBarrios(searchText) {
    const datos = window.barriosData || barriosData || [];
    if (!datos.length) return [];
    
    const searchUpper = searchText.toUpperCase();
    return datos.filter(barrio => 
        barrio.nombre && barrio.nombre.toUpperCase().includes(searchUpper) ||
        (barrio.id && barrio.id.toUpperCase().includes(searchUpper))
    ).slice(0, 10);
}

function handleBarrioKeydown(e) {
    if (!autocompleteDropdown || window.getComputedStyle(autocompleteDropdown).display !== 'block') return;
    
    const items = autocompleteDropdown.querySelectorAll('.autocomplete-item');
    
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveFocus('down', items);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveFocus('up', items);
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (items[currentFocus]) {
            dropdownJustClicked = true;
            const clickEvent = new MouseEvent('click', { bubbles: true });
            items[currentFocus].dispatchEvent(clickEvent);
            setTimeout(() => { dropdownJustClicked = false; }, 100);
        }
    } else if (e.key === 'Escape') {
        hideDropdown();
        if (barrioInput) barrioInput.focus();
    }
}

function handleBarrioFocus() {
    console.log('🎯 Campo barrio enfocado');
    const searchText = barrioInput.value.trim();
    
    if (searchText.length >= 1) {
        filteredBarrios = filterBarrios(searchText);
        showAutocomplete(filteredBarrios);
    }
}

function showAutocomplete(results) {
    if (!autocompleteDropdown || !barrioInput) return;
    
    console.log(`🎯 Mostrando ${results.length} resultados`);
    
    autocompleteDropdown.innerHTML = '';
    
    if (results.length === 0) {
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        item.textContent = 'No se encontraron barrios';
        autocompleteDropdown.appendChild(item);
        
        showDropdown();
    } else {
        results.forEach((barrio, index) => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            item.innerHTML = `
                <span class="barrio-id">${barrio.id || 'N/A'}</span>
                <span class="barrio-nombre">${barrio.nombre || ''}</span>
            `;
            
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropdownJustClicked = true;
                
                setTimeout(() => {
                    console.log(`✅ Seleccionado: ${barrio.nombre}`);
                    barrioInput.value = barrio.nombre || '';
                    if (barrioIdInput) barrioIdInput.value = barrio.id || '';
                    hideDropdown();
                    
                    setTimeout(() => {
                        dropdownJustClicked = false;
                    }, 50);
                    
                    barrioInput.focus();
                }, 10);
            });
            
            autocompleteDropdown.appendChild(item);
        });
        
        showDropdown();
    }
}

function showDropdown() {
    if (!autocompleteDropdown) return;
    
    if (closeBarrioDropdownTimeout) {
        clearTimeout(closeBarrioDropdownTimeout);
        closeBarrioDropdownTimeout = null;
    }
    
    autocompleteDropdown.className = '';
    autocompleteDropdown.classList.add('autocomplete-dropdown-visible');
    
    const aggressiveStyles = `
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        position: absolute !important;
        top: calc(100% + 5px) !important;
        left: 0 !important;
        width: 100% !important;
        z-index: 999999 !important;
        background-color: white !important;
        border: 1px solid #e5e7eb !important;
        border-radius: 8px !important;
        box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1) !important;
        max-height: 300px !important;
        overflow-y: auto !important;
        margin-top: 5px !important;
        padding: 5px !important;
    `;
    
    autocompleteDropdown.style.cssText = aggressiveStyles;
    
    console.log('✅ Dropdown visible - Estilos agresivos aplicados');
}

function hideDropdown() {
    if (!autocompleteDropdown) return;
    
    const estilo = window.getComputedStyle(autocompleteDropdown);
    const isVisible = estilo.display === 'block' || 
                      autocompleteDropdown.style.display === 'block';
    
    if (isVisible) {
        console.log('✅ Cerrando dropdown (autorizado)');
        autocompleteDropdown.style.display = 'none';
        currentFocus = -1;
    }
}

function moveFocus(direction, items) {
    if (!items.length) return;
    
    items.forEach(item => item.classList.remove('highlighted'));
    
    if (direction === 'down') currentFocus = (currentFocus + 1) % items.length;
    else if (direction === 'up') currentFocus = (currentFocus - 1 + items.length) % items.length;
    
    if (items[currentFocus]) {
        items[currentFocus].classList.add('highlighted');
        items[currentFocus].scrollIntoView({ block: 'nearest' });
    }
}

// ============================================
// FUNCIONES PARA AUTOCOMPLETE DE REMITENTES
// ============================================

function inicializarAutocompleteRemitente() {
    console.log("🔧 ===== INICIALIZANDO AUTOCOMPLETE REMITENTES =====");
    
    const inputRemitente = document.getElementById('remitente');
    let dropdown = document.getElementById('remitenteAutocomplete');
    
    if (!inputRemitente) {
        console.error("❌ No se encontró el campo remitente");
        return;
    }
    
    // Crear dropdown si no existe
    if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.id = 'remitenteAutocomplete';
        dropdown.className = 'autocomplete-dropdown';
        dropdown.style.cssText = `
            display: none;
            position: absolute;
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
            max-height: 300px;
            overflow-y: auto;
            z-index: 9999;
            width: 100%;
        `;
        document.body.appendChild(dropdown);
        console.log("✅ Dropdown creado dinámicamente");
    }
    
    // Verificar que tenemos datos
    if (!usuariosDisponibles || usuariosDisponibles.length === 0) {
        console.warn("⚠️ No hay usuarios disponibles para autocomplete");
        console.log("🔄 Cargando usuarios...");
        loadUsuariosParaAutocomplete().then(() => {
            if (usuariosDisponibles.length > 0) {
                console.log(`✅ ${usuariosDisponibles.length} usuarios cargados, reinicializando autocomplete`);
                setTimeout(() => inicializarAutocompleteRemitente(), 500);
            }
        });
        return;
    }
    
    console.log(`📊 Usando ${usuariosDisponibles.length} usuarios para autocomplete`);
    
    // Variables de estado
    let ignoreBlur = false;
    let mouseInDropdown = false;
    
    // Función para buscar remitentes
    function buscarRemitentes(texto) {
        if (!texto || texto.length < 1) return [];
        
        const busqueda = texto.toLowerCase().trim();
        
        return usuariosDisponibles.filter(usuario => {
            const nombre = (usuario["NOMBRE REMITENTE"] || "").toString().toLowerCase();
            const nombreCompleto = (usuario["NOMBRE COMPLETO"] || "").toString().toLowerCase();
            
            const telefonoRemitente = usuario["TELEFONO REMITENTE"];
            const telefono = usuario.TELEFONO;
            const telefonoStr = (telefonoRemitente ? telefonoRemitente.toString() : 
                                telefono ? telefono.toString() : "").toLowerCase();
            
            const correo = (usuario["CORREO ELECTRONICO"] || "").toString().toLowerCase();
            
            return nombre.includes(busqueda) || 
                   nombreCompleto.includes(busqueda) ||
                   telefonoStr.includes(busqueda) ||
                   correo.includes(busqueda);
        });
    }
    
    // Función para mostrar sugerencias
    function mostrarSugerencias(usuarios) {
        dropdown.innerHTML = '';
        
        if (usuarios.length === 0) {
            dropdown.style.display = 'none';
            return;
        }
        
        console.log(`📋 Mostrando ${usuarios.length} sugerencias (¡HAZ CLIC!)`);
        
        const usuariosMostrar = usuarios.slice(0, 5);
        
        usuariosMostrar.forEach((usuario, index) => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            item.dataset.index = index;
            item.style.cssText = `
                padding: 12px 15px;
                cursor: pointer;
                border-bottom: 1px solid #f3f4f6;
                transition: all 0.2s;
                position: relative;
            `;
            
            const telefono = usuario["TELEFONO REMITENTE"] || usuario.TELEFONO;
            const telefonoStr = telefono ? telefono.toString() : "";
            
            item.innerHTML = `
                <div style="display: flex; align-items: center;">
                    <div style="flex-grow: 1;">
                        <div style="font-size: 14px; color: #111827; font-weight: 600; margin-bottom: 4px;">
                            ${usuario["NOMBRE REMITENTE"] || usuario["NOMBRE COMPLETO"] || "Sin nombre"}
                        </div>
                        <div style="font-size: 12px; color: #6b7280;">
                            <div>📞 ${telefonoStr || "Sin teléfono"}</div>
                            ${usuario["DIRECCION REMITente"] ? `<div>📍 ${usuario["DIRECCION REMITENTE"].substring(0, 40)}...</div>` : ''}
                        </div>
                    </div>
                    <div style="color: #10b981; font-size: 12px; font-weight: bold; padding: 4px 8px; background: #d1fae5; border-radius: 4px;">
                        SELECCIONAR
                    </div>
                </div>
            `;
            
            // ========== EVENTO CLIC MEJORADO ==========
            item.addEventListener('mousedown', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log("🖱️ CLIC detectado en item (mousedown)");
                
                ignoreBlur = true;
                
                // Pequeño delay para asegurar que el click se procese
                setTimeout(() => {
                    console.log("🎯 Procesando selección...");
                    
                    // Obtener valores del usuario
                    const telefonoValor = usuario["TELEFONO REMITENTE"] || usuario.TELEFONO;
                    const telefonoStr = telefonoValor ? telefonoValor.toString() : "";
                    
                    // Asignar valores DIRECTAMENTE
                    document.getElementById('remitente').value = usuario["NOMBRE REMITENTE"] || usuario["NOMBRE COMPLETO"] || "";
                    document.getElementById('telefonoRemitente').value = telefonoStr;
                    document.getElementById('direccionRemitente').value = usuario["DIRECCION REMITENTE"] || "";
                    
                    // Disparar eventos para actualizar UI
                    ['remitente', 'telefonoRemitente', 'direccionRemitente'].forEach(id => {
                        const campo = document.getElementById(id);
                        if (campo) {
                            campo.dispatchEvent(new Event('input', { bubbles: true }));
                            campo.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    });
                    
                    // Mostrar mensaje de confirmación
                    console.log("✅ VALORES ASIGNADOS:");
                    console.log("   Remitente:", document.getElementById('remitente').value);
                    console.log("   Teléfono:", document.getElementById('telefonoRemitente').value);
                    console.log("   Dirección:", document.getElementById('direccionRemitente').value);
                    
                    // Ocultar dropdown inmediatamente
                    dropdown.style.display = 'none';
                    dropdown.innerHTML = '';
                    
                    // Enfocar siguiente campo
                    setTimeout(() => {
                        const siguienteCampo = document.getElementById('destinatario');
                        if (siguienteCampo) {
                            siguienteCampo.focus();
                        }
                    }, 100);
                    
                    // Resetear flag
                    setTimeout(() => {
                        ignoreBlur = false;
                    }, 300);
                }, 10);
            });
            
            // También manejar click normal como backup
            item.addEventListener('click', function(e) {
                console.log("🖱️ CLIC detectado en item (click)");
                // El mousedown ya maneja la lógica
            });
            
            // Efectos visuales
            item.addEventListener('mouseenter', function() {
                this.style.backgroundColor = '#eff6ff';
                this.style.transform = 'translateX(2px)';
                mouseInDropdown = true;
            });
            
            item.addEventListener('mouseleave', function() {
                this.style.backgroundColor = '';
                this.style.transform = '';
                mouseInDropdown = false;
            });
            
            dropdown.appendChild(item);
        });
        
        // Posicionar dropdown
        const inputRect = inputRemitente.getBoundingClientRect();
        dropdown.style.position = 'fixed';
        dropdown.style.top = `${inputRect.bottom + window.scrollY}px`;
        dropdown.style.left = `${inputRect.left + window.scrollX}px`;
        dropdown.style.width = `${inputRect.width}px`;
        dropdown.style.display = 'block';
        
        // Trackear mouse en dropdown
        dropdown.addEventListener('mouseenter', () => {
            mouseInDropdown = true;
        });
        
        dropdown.addEventListener('mouseleave', () => {
            mouseInDropdown = false;
        });
    }
    
    // Configurar eventos del input
    let timeoutId;
    
    inputRemitente.addEventListener('input', function(e) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            const resultados = buscarRemitentes(this.value);
            mostrarSugerencias(resultados);
        }, 300);
    });
    
    inputRemitente.addEventListener('focus', function() {
        console.log("🎯 Campo remitente enfocado - MOSTRANDO SUGERENCIAS");
        
        if (this.value.length >= 1) {
            const resultados = buscarRemitentes(this.value);
            mostrarSugerencias(resultados);
        } else {
            // Mostrar todos si está vacío
            mostrarSugerencias(usuariosDisponibles.slice(0, 3));
        }
    });
    
    // MEJORAR MANEJO DE BLUR
    inputRemitente.addEventListener('blur', function(e) {
        // Solo ocultar si no estamos interactuando con el dropdown
        setTimeout(() => {
            if (!ignoreBlur && !mouseInDropdown) {
                dropdown.style.display = 'none';
                console.log("👆 Blur normal - ocultando dropdown");
            } else {
                console.log("⏸️ Blur ignorado - usuario interactuando con dropdown");
            }
        }, 200);
    });
    
    // EVENTO ESPECIAL: cuando el usuario hace clic en el dropdown
    dropdown.addEventListener('mousedown', function(e) {
        console.log("🖱️ Mouse down en dropdown - previniendo blur");
        ignoreBlur = true;
        e.stopPropagation();
    });
    
    // Click fuera para ocultar (pero no inmediatamente)
    document.addEventListener('mousedown', function(e) {
        const clickEnInput = inputRemitente.contains(e.target);
        const clickEnDropdown = dropdown.contains(e.target);
        
        if (!clickEnInput && !clickEnDropdown) {
            // Pequeño delay para permitir que los clicks en el dropdown se procesen
            setTimeout(() => {
                if (!mouseInDropdown) {
                    dropdown.style.display = 'none';
                    console.log("👆 Click fuera - ocultando dropdown");
                }
            }, 100);
        }
    });
    
    // Navegación con teclado
    inputRemitente.addEventListener('keydown', function(e) {
        const items = dropdown.querySelectorAll('.autocomplete-item');
        
        if (items.length === 0) return;
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (items[0]) {
                items[0].focus();
                items[0].style.backgroundColor = '#eff6ff';
            }
        }
        
        if (e.key === 'Enter' && dropdown.style.display === 'block') {
            e.preventDefault();
            if (items[0]) {
                console.log("↵ Enter presionado - simulando click");
                items[0].click();
            }
        }
        
        if (e.key === 'Escape') {
            dropdown.style.display = 'none';
        }
    });
    
    console.log("✅ Auto-complete inicializado - ¡LISTO PARA PROBAR!");
}

// ============================================
// FUNCIONES PARA EL FORMULARIO
// ============================================

function inicializarFormulario() {
    console.log("📝 Inicializando formulario...");
    
    // Configurar opciones de pago
    const paymentOptions = document.querySelectorAll('.payment-option');
    const formaPagoInput = document.getElementById('formaPago');
    
    paymentOptions.forEach(option => {
        option.addEventListener('click', function() {
            // Remover clase selected de todas las opciones
            paymentOptions.forEach(opt => opt.classList.remove('selected'));
            
            // Agregar clase selected a la opción clickeada
            this.classList.add('selected');
            
            // Actualizar valor del input hidden
            const selectedValue = this.getAttribute('data-value');
            formaPagoInput.value = selectedValue;
            
            // Actualizar resumen
            actualizarResumen();
            
            // Manejar campo de valor a recaudar
            manejarValorRecaudar(selectedValue);
        });
    });

    // Seleccionar "Contado" por defecto
    if (paymentOptions[0]) {
        paymentOptions[0].click();
    }
    
    // Configurar botón cancelar
    document.getElementById('cancelButton').addEventListener('click', function() {
        if (confirm('¿Estás seguro de que deseas cancelar este envío? Se perderán todos los datos ingresados.')) {
            resetearFormulario();
        }
    });
    
    // Configurar logout
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', function() {
            if (confirm("¿Estás seguro de que deseas cerrar sesión?")) {
                localStorage.removeItem("usuarioLogueado");
                window.location.href = "login.html";
            }
        });
    }
    
    // Configurar historial
    const historialButton = document.getElementById('historialButton');
    if (historialButton) {
        historialButton.addEventListener('click', function() {
            const user = JSON.parse(localStorage.getItem("usuarioLogueado"));
            if (user && user.USUARIO) {
                window.open(`historial.html?usuario=${encodeURIComponent(user.USUARIO)}`, '_blank');
            } else {
                alert('No se pudo identificar el usuario');
            }
        });
    }
    
    // Manejar envío del formulario
    document.getElementById('deliveryForm').addEventListener('submit', manejarEnvioFormulario);
    
    console.log("✅ Formulario inicializado correctamente");
}

function manejarValorRecaudar(formaPago) {
    const valorRecaudarInput = document.getElementById('valorRecaudar');
    const valorRecaudarHelp = document.getElementById('valorRecaudarHelp');
    const autoRecaudoLabel = document.getElementById('autoRecaudoLabel');
    const ciudadDestino = document.getElementById('ciudadDestino').value;
    
    if (formaPago === 'contraentrega' || formaPago === 'contraentrega_recaudo') {
        // Habilitar campo
        valorRecaudarInput.disabled = false;
        valorRecaudarInput.placeholder = "Ej. 50,000";
        valorRecaudarHelp.textContent = "Ingrese el valor a recaudar al destinatario";
        
        // Si es "Contraentrega" (no "Con Recaudo"), establecer valor automático
        if (formaPago === 'contraentrega') {
            // Establecer valor según ciudad
            let valorAuto = 0;
            if (ciudadDestino.includes("Bogotá")) {
                valorAuto = 10000;
            } else if (ciudadDestino.includes("Soacha")) {
                valorAuto = 12000;
            }
            
            valorRecaudarInput.value = valorAuto;
            valorRecaudarInput.disabled = true; // Hacerlo de solo lectura
            autoRecaudoLabel.classList.remove('hidden');
            autoRecaudoLabel.textContent = 'AUTO';
            valorRecaudarHelp.textContent = `Valor automático para ${ciudadDestino}`;
            
            // Estilos para indicar que es automático
            valorRecaudarInput.classList.remove('bg-input-light', 'dark:bg-input-dark');
            valorRecaudarInput.classList.add('bg-gray-100', 'dark:bg-gray-800', 'text-gray-700', 'dark:text-gray-300');
        } else {
            // Para "Contraentrega con Recaudo": campo editable
            valorRecaudarInput.value = "";
            autoRecaudoLabel.classList.add('hidden');
            valorRecaudarHelp.textContent = "Ingrese el valor a recaudar al destinatario";
            
            // Estilos para indicar que es editable
            valorRecaudarInput.classList.remove('bg-gray-100', 'dark:bg-gray-800');
            valorRecaudarInput.classList.add('bg-input-light', 'dark:bg-input-dark', 'text-[#0d121b]', 'dark:text-white');
        }
        
        // Agregar validación
        valorRecaudarInput.addEventListener('input', function() {
            const valor = parseFloat(this.value) || 0;
            if (valor > 0) {
                this.classList.remove('invalid');
            } else {
                this.classList.add('invalid');
            }
            actualizarResumen();
        });
        
    } else if (formaPago === 'contado') {
        // Deshabilitar campo y poner valor automático
        valorRecaudarInput.disabled = true;
        valorRecaudarInput.value = "";
        valorRecaudarHelp.textContent = "No aplica para pagos de contado";
        autoRecaudoLabel.classList.add('hidden');
        
        // Estilos para indicar que es deshabilitado
        valorRecaudarInput.classList.remove('bg-input-light', 'dark:bg-input-dark', 'text-[#0d121b]', 'dark:text-white');
        valorRecaudarInput.classList.add('bg-gray-100', 'dark:bg-gray-800', 'text-gray-500', 'dark:text-gray-400');
        
        // Remover validación
        valorRecaudarInput.classList.remove('invalid');
    }
    
    // Actualizar resumen siempre
    actualizarResumen();
}

function calcularValorARecaudar() {
    const ciudadDestino = document.getElementById('ciudadDestino').value;
    let valorRecaudar = 0;
    
    if (ciudadDestino.includes("Bogotá")) {
        valorRecaudar = 10000;
    } else if (ciudadDestino.includes("Soacha")) {
        valorRecaudar = 12000;
    }
    
    // Actualizar el campo de valor a recaudar
    const valorRecaudarInput = document.getElementById('valorRecaudar');
    const formaPago = document.getElementById('formaPago').value;
    
    // Solo actualizar si es contraentrega (en contado no se muestra)
    if (formaPago === 'contraentrega' || formaPago === 'contraentrega_recaudo') {
        valorRecaudarInput.value = valorRecaudar;
        valorRecaudarInput.classList.remove('invalid');
    }
    
    return valorRecaudar;
}

function calcularTotalAPagar() {
    const formaPago = document.getElementById('formaPago').value;
    const valorRecaudar = parseFloat(document.getElementById('valorRecaudar').value) || 0;
    const ciudadDestino = document.getElementById('ciudadDestino').value;
    let totalAPagar = 0;
    
    if (formaPago === 'contraentrega_recaudo') {
        // Para contraentrega con recaudo: valorRecaudar - tarifa de la ciudad
        if (ciudadDestino.includes("Bogotá")) {
            totalAPagar = Math.max(0, valorRecaudar - 10000);
        } else if (ciudadDestino.includes("Soacha")) {
            totalAPagar = Math.max(0, valorRecaudar - 12000);
        }
    }
    // Para contado y contraentrega normal: total a pagar = 0
    
    return totalAPagar;
}

// ============================================
// CONFIGURACIÓN DE EVENT LISTENERS
// ============================================

function setupEventListeners() {
    console.log('🔗 Configurando event listeners...');
    
    // Configurar cambio de ciudad destino
    const ciudadDestinoSelect = document.getElementById('ciudadDestino');
    if (ciudadDestinoSelect) {
        ciudadDestinoSelect.addEventListener('change', function() {
            const ciudad = this.value;
            const formaPago = document.getElementById('formaPago').value;
            
            // Si la forma de pago es "Contraentrega", actualizar el valor automáticamente
            if (formaPago === 'contraentrega') {
                let valorAuto = 0;
                if (ciudad.includes("Bogotá")) {
                    valorAuto = 10000;
                } else if (ciudad.includes("Soacha")) {
                    valorAuto = 12000;
                }
                
                document.getElementById('valorRecaudar').value = valorAuto;
            }
            
            // Calcular y actualizar valor a recaudar
            const valorRecaudar = calcularValorARecaudar();
            
            // Actualizar resumen
            actualizarResumen();
        });
    }
    
    if (paymentOptions.length) {
        paymentOptions.forEach(option => {
            option.addEventListener('click', function() {
                updatePaymentUI(this.getAttribute('data-value'));
            });
        });
    }
    
    if (barrioInput) {
        barrioInput.addEventListener('input', handleBarrioInput);
        barrioInput.addEventListener('keydown', handleBarrioKeydown);
        barrioInput.addEventListener('focus', handleBarrioFocus);
        
        barrioInput.addEventListener('click', function(e) {
            e.stopPropagation();
            const searchText = this.value.trim();
            
            if (searchText.length >= 2) {
                setTimeout(() => {
                    handleBarrioInput.call(this);
                }, 50);
            }
        });
    }
    
    if (valorRecaudarInput) {
        valorRecaudarInput.addEventListener('input', updateSummary);
    }
    
    setupDropdownCloseBehavior();
    
    const form = document.getElementById('deliveryForm');
    if (form) form.addEventListener('submit', manejarEnvioFormulario);
    
    const cancelBtn = document.getElementById('cancelButton');
    if (cancelBtn) cancelBtn.addEventListener('click', handleCancel);
    
    console.log('✅ Listeners configurados');
}

function setupDropdownCloseBehavior() {
    console.log('🔧 Configurando comportamiento MEJORADO del dropdown...');
    
    let escribiendo = false;
    let dropdownJustClicked = false;
    let ignoreBlur = false;
    
    // Click en dropdown - No cerrar
    document.addEventListener('mousedown', function(e) {
        if (!autocompleteDropdown || !autocompleteDropdown.contains(e.target)) {
            return;
        }
        
        console.log('🎯 Click en dropdown - previniendo cierre');
        dropdownJustClicked = true;
        ignoreBlur = true;
        
        setTimeout(() => {
            dropdownJustClicked = false;
            ignoreBlur = false;
        }, 300);
    });
    
    // Click fuera - Cerrar solo si no está interactuando
    document.addEventListener('click', function(e) {
        if (!autocompleteDropdown || !barrioInput) return;
        
        if (dropdownJustClicked || escribiendo) {
            console.log('⏸️ No cerrar - usuario interactuando');
            return;
        }
        
        const clickedInput = barrioInput.contains(e.target);
        const clickedDropdown = autocompleteDropdown.contains(e.target);
        
        const isVisible = autocompleteDropdown.style.display === 'block' || 
                         window.getComputedStyle(autocompleteDropdown).display === 'block';
        
        if (isVisible && !clickedInput && !clickedDropdown) {
            console.log('👆 Click fuera - cerrando dropdown');
            hideDropdown();
        }
    });
    
    // Tecla Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const isVisible = autocompleteDropdown && 
                (autocompleteDropdown.style.display === 'block' || 
                 window.getComputedStyle(autocompleteDropdown).display === 'block');
            
            if (isVisible) {
                console.log('⎋ Escape - cerrando dropdown');
                hideDropdown();
                if (barrioInput) barrioInput.focus();
            }
        }
    });
    
    if (barrioInput) {
        // Detectar escritura
        barrioInput.addEventListener('input', function() {
            escribiendo = true;
            ignoreBlur = true;
            
            console.log('📝 Escribiendo - manteniendo dropdown visible');
            
            clearTimeout(this._writingTimeout);
            this._writingTimeout = setTimeout(() => {
                escribiendo = false;
                ignoreBlur = false;
                console.log('⏹️ Terminó de escribir');
            }, 500);
        });
        
        // Blur inteligente - ¡LA CLAVE!
        barrioInput.addEventListener('blur', function() {
            console.log('⚠️ Blur detectado - escribiendo:', escribiendo, '- ignoreBlur:', ignoreBlur);
            
            if (escribiendo || ignoreBlur || dropdownJustClicked) {
                console.log('🚫 Ignorando blur - recuperando foco');
                
                // Recuperar foco inmediatamente
                setTimeout(() => {
                    if (barrioInput) {
                        barrioInput.focus();
                        // Poner cursor al final
                        const len = barrioInput.value.length;
                        barrioInput.setSelectionRange(len, len);
                    }
                }, 10);
                
                return;
            }
            
            // Solo cerrar después de verificar
            setTimeout(() => {
                if (!dropdownJustClicked && !escribiendo) {
                    const isVisible = autocompleteDropdown && 
                        (autocompleteDropdown.style.display === 'block' || 
                         window.getComputedStyle(autocompleteDropdown).display === 'block');
                    
                    if (isVisible) {
                        const activeElement = document.activeElement;
                        const focusInDropdown = activeElement && 
                            autocompleteDropdown.contains(activeElement);
                        
                        if (!focusInDropdown) {
                            console.log('🔒 Cerrando dropdown (blur normal)');
                            hideDropdown();
                        }
                    }
                }
            }, 150);
        });
        
        // Focus - mostrar dropdown si hay texto
        barrioInput.addEventListener('focus', function() {
            console.log('🎯 Campo enfocado');
            const searchText = this.value.trim();
            
            if (searchText.length >= 1) {
                setTimeout(() => {
                    handleBarrioInput.call(this);
                }, 50);
            }
        });
    }
    
    console.log('✅ Comportamiento mejorado configurado');
}

// ============================================
// FUNCIONES DE UI
// ============================================

function initializeUI() {
    const ciudadOrigenField = document.getElementById('ciudadOrigen');
    if (ciudadOrigenField) {
        ciudadOrigenField.value = 'Bogotá D.C.';
    }
    
    updatePaymentUI('contado');
    inicializarFormulario();
}

function updatePaymentUI(selectedPayment) {
    console.log(`💳 Forma de pago: ${selectedPayment}`);
    
    if (formaPagoInput) formaPagoInput.value = selectedPayment;
    
    paymentOptions.forEach(option => {
        const isSelected = option.getAttribute('data-value') === selectedPayment;
        option.classList.toggle('selected', isSelected);
        option.classList.toggle('border-primary', isSelected);
    });
    
    if (valorRecaudarInput) {
        switch(selectedPayment) {
            case 'contado':
                valorRecaudarInput.disabled = true;
                valorRecaudarInput.value = '';
                if (autoRecaudoLabel) autoRecaudoLabel.classList.add('hidden');
                break;
            case 'contraentrega':
                valorRecaudarInput.disabled = true;
                valorRecaudarInput.value = '10000';
                if (autoRecaudoLabel) {
                    autoRecaudoLabel.classList.remove('hidden');
                    autoRecaudoLabel.textContent = 'FIJO';
                }
                break;
            case 'contraentrega_recaudo':
                valorRecaudarInput.disabled = false;
                valorRecaudarInput.value = '';
                if (autoRecaudoLabel) autoRecaudoLabel.classList.add('hidden');
                break;
        }
    }
    
    updateSummary();
}

function updateSummary() {
    if (!resumenFormaPago || !resumenValorRecaudar || !resumenEstado || !formaPagoInput) return;
    
    const formasPago = {
        'contado': 'Contado',
        'contraentrega': 'Contraentrega',
        'contraentrega_recaudo': 'Contraentrega con Recaudo'
    };
    
    resumenFormaPago.textContent = formasPago[formaPagoInput.value] || 'Contado';
    
    if (formaPagoInput.value === 'contraentrega') {
        resumenValorRecaudar.textContent = '$10,000';
        resumenEstado.textContent = 'Recaudo fijo';
        resumenEstado.className = 'font-semibold text-blue-600';
    } else if (formaPagoInput.value === 'contraentrega_recaudo') {
        const valor = valorRecaudarInput && valorRecaudarInput.value ? 
            `$${parseInt(valorRecaudarInput.value).toLocaleString()}` : '$0';
        resumenValorRecaudar.textContent = valor;
        resumenEstado.textContent = valorRecaudarInput.value ? 'Recaudo variable' : 'Sin valor';
        resumenEstado.className = 'font-semibold text-orange-600';
    } else {
        resumenValorRecaudar.textContent = '$0';
        resumenEstado.textContent = 'Por confirmar';
        resumenEstado.className = 'font-semibold text-green-600';
    }
}

function actualizarResumen() {
    const formaPago = document.getElementById('formaPago').value;
    const ciudadDestino = document.getElementById('ciudadDestino').value;
    const valorRecaudar = document.getElementById('valorRecaudar').value;
    
    // Actualizar texto de forma de pago
    const formasPagoTexto = {
        'contado': 'Contado',
        'contraentrega': 'Contraentrega',
        'contraentrega_recaudo': 'Con Recaudo'
    };
    document.getElementById('resumenFormaPago').textContent = formasPagoTexto[formaPago];
    
    // Actualizar valor a recaudar en resumen
    let valorRecaudarTexto = 'No aplica';
    if (formaPago !== 'contado' && valorRecaudar) {
        const valorFormateado = new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        }).format(parseFloat(valorRecaudar));
        valorRecaudarTexto = valorFormateado;
    }
    document.getElementById('resumenValorRecaudar').textContent = valorRecaudarTexto;
    
    // Calcular total a pagar
    const totalAPagar = calcularTotalAPagar();
    let totalTexto = 'No aplica';
    let estadoTexto = 'Por confirmar';
    let estadoColor = 'text-yellow-600 dark:text-yellow-400';
    
    if (ciudadDestino) {
        // Mostrar tarifa según ciudad
        let tarifaCiudad = 0;
        if (ciudadDestino.includes("Bogotá")) {
            tarifaCiudad = 10000;
        } else if (ciudadDestino.includes("Soacha")) {
            tarifaCiudad = 12000;
        }
        
        // Actualizar estado según forma de pago
        if (formaPago === 'contado') {
            estadoTexto = 'Pendiente de pago';
            estadoColor = 'text-yellow-600 dark:text-yellow-400';
            totalTexto = '$0'; // No le pagas nada al cliente
        } else if (formaPago === 'contraentrega') {
            estadoTexto = 'A recaudar';
            estadoColor = 'text-blue-600 dark:text-blue-400';
            totalTexto = '$0'; // No le pagas nada al cliente
        } else if (formaPago === 'contraentrega_recaudo') {
            estadoTexto = 'Con recaudo';
            estadoColor = 'text-orange-600 dark:text-orange-400';
            const totalFormateado = new Intl.NumberFormat('es-CO', {
                style: 'currency',
                currency: 'COP',
                minimumFractionDigits: 0
            }).format(totalAPagar);
            totalTexto = totalFormateado;
        }
    }
    
    // Actualizar elemento de estado
    let estadoElement = document.getElementById('resumenEstado');
    if (!estadoElement) {
        estadoElement = document.createElement('span');
        estadoElement.id = 'resumenEstado';
        estadoElement.className = 'font-semibold';
        const resumenContainer = document.querySelector('.bg-blue-50');
        if (resumenContainer) {
            const estadoDiv = resumenContainer.querySelector('div:last-child');
            if (estadoDiv) {
                estadoDiv.innerHTML = '<span class="text-sm text-gray-600 dark:text-gray-400">Estado:</span><br>';
                estadoDiv.appendChild(estadoElement);
            }
        }
    }
    
    estadoElement.textContent = estadoTexto;
    estadoElement.className = `font-semibold ${estadoColor}`;
    
    // Mostrar total a pagar en el resumen
    let totalElement = document.getElementById('resumenTotalPagar');
    if (!totalElement) {
        totalElement = document.createElement('span');
        totalElement.id = 'resumenTotalPagar';
        totalElement.className = 'font-bold text-lg text-green-600 dark:text-green-400';
        const resumenGrid = document.querySelector('.grid.grid-cols-1.md\\:grid-cols-3.gap-4');
        if (resumenGrid) {
            const totalDiv = document.createElement('div');
            totalDiv.className = 'flex flex-col';
            totalDiv.innerHTML = '<span class="text-sm text-gray-600 dark:text-gray-400">Total a Pagar al Cliente:</span>';
            totalDiv.appendChild(totalElement);
            resumenGrid.appendChild(totalDiv);
        }
    }
    
    totalElement.textContent = totalTexto;
}

// ============================================
// FUNCIÓN PARA MANEJAR EL ENVÍO DEL FORMULARIO
// ============================================

async function manejarEnvioFormulario(e) {
    e.preventDefault();
    
    // Prevenir envíos múltiples
    if (formularioEnviandose) {
        console.log('⚠️ Formulario ya enviándose, ignorando clic...');
        return;
    }
    
    console.log('📤 Iniciando envío de formulario...');
    
    // Validar formulario
    if (!validarFormulario()) {
        alert('Por favor complete todos los campos requeridos correctamente');
        return;
    }
    
    // Deshabilitar botón de envío y mostrar loading
    const submitButton = document.getElementById('submitButton');
    const submitText = document.getElementById('submitText');
    const submitIcon = document.getElementById('submitIcon');
    
    submitButton.disabled = true;
    formularioEnviandose = true;
    submitButton.classList.add('opacity-70', 'cursor-not-allowed');
    submitText.textContent = 'Procesando...';
    submitIcon.textContent = 'hourglass_top';
    
    try {
        // Calcular valores
        const formaPago = document.getElementById('formaPago').value;
        const ciudadDestino = document.getElementById('ciudadDestino').value;
        
        // IMPORTANTE: Forzar el cálculo del valor a recaudar según ciudad
        let valorRecaudar;
        
        if (formaPago === 'contraentrega') {
            // Para "Contraentrega": valor fijo según ciudad
            if (ciudadDestino.includes("Bogotá")) {
                valorRecaudar = 10000;
            } else if (ciudadDestino.includes("Soacha")) {
                valorRecaudar = 12000;
            }
            // Actualizar el campo visualmente
            document.getElementById('valorRecaudar').value = valorRecaudar;
        } else if (formaPago === 'contraentrega_recaudo') {
            // Para "Contraentrega con Recaudo": usar el valor del campo
            valorRecaudar = parseFloat(document.getElementById('valorRecaudar').value) || 0;
        } else {
            valorRecaudar = 0;
        }
        
        const totalAPagar = calcularTotalAPagar();
        const usuarioActual = JSON.parse(localStorage.getItem("usuarioLogueado"));
        
        // ============================================
        // PASO 1: GENERAR UN ÚNICO ID AL PRINCIPIO
        // ============================================
        const idLocal = generarIDLocal();
        console.log("🆔 ID ÚNICO generado para TODO:", idLocal);
        
        // ============================================
        // DATOS ENVIADOS A GOOGLE SHEETS (CON EL MISMO ID)
        // ============================================
        const datosEnvio = {
            // Columna A: ENVIO ID - ¡USAR EL MISMO ID LOCAL!
            "ENVIO ID": idLocal,
            
            // Columna B: FORMA DE PAGO
            "FORMA DE PAGO": formaPago,
            
            // Columna C: REMITE
            "REMITE": document.getElementById('remitente').value,
            
            // Columna D: TELEFONO
            "TELEFONO": document.getElementById('telefonoRemitente').value,
            
            // Columna E: DIRECCION
            "DIRECCION": document.getElementById('direccionRemitente').value,
            
            // Columna F: CIUDAD
            "CIUDAD": document.getElementById('ciudadOrigen').value,
            
            // Columna G: DESTINO
            "DESTINO": document.getElementById('destinatario').value,
            
            // Columna H: DIRECCION DESTINO
            "DIRECCION DESTINO": document.getElementById('direccionDestino').value,
            
            // Columna I: BARRIO
            "BARRIO": document.getElementById('barrioLocalidad').value,
            
            // Columna J: TELEFONOCLIENTE
            "TELEFONOCLIENTE": document.getElementById('telefonoCliente').value,
            
            // Columna K: COMPLEMENTO DE DIR
            "COMPLEMENTO DE DIR": document.getElementById('complementoDireccion').value || "",
            
            // Columna L: CIUDAD DESTINO
            "CIUDAD DESTINO": ciudadDestino,
            
            // Columna M: VALOR A RECAUDAR
            "VALOR A RECAUDAR": valorRecaudar.toString(),
            
            // Columna N: TOTAL A PAGAR
            "TOTAL A PAGAR": totalAPagar.toString(),
            
            // Columna O: PAGADO A REMITENTE
            "PAGADO A REMITENTE": "false",
            
            // Columna P: FECHA PAGO (vacío)
            "FECHA PAGO": "",
            
            // Columna Q: FIRMA (vacío)
            "FIRMA": "",
            
            // Columna R: OBS (vacío)
            "OBS": "",
            
            // Columna S: LOCALIDAD (se llenará después)
            "LOCALIDAD": "",
            
            // Columna T: MENSAJERO (se llenará después)
            "MENSAJERO": "",
            
            // Columna U: CORREO REMITENTE
            "CORREO REMITENTE": document.getElementById('correoRemitente').value || "",
            
            // Columna V: USUARIO ID
            "USUARIO ID": usuarioActual ? usuarioActual.USUARIO : ""
        };
        
        console.log('📝 Datos a enviar a Google Sheets (con ID único):', datosEnvio);
        
        // Verificar que TODOS los campos requeridos estén presentes
        const camposRequeridos = [
            "ENVIO ID", "FORMA DE PAGO", "REMITE", "TELEFONO", "DIRECCION", 
            "CIUDAD", "DESTINO", "DIRECCION DESTINO", "BARRIO",
            "TELEFONOCLIENTE", "CIUDAD DESTINO", "VALOR A RECAUDAR",
            "TOTAL A PAGAR", "PAGADO A REMITENTE", "USUARIO ID"
        ];
        
        let faltanCampos = [];
        camposRequeridos.forEach(campo => {
            if (!datosEnvio[campo] && datosEnvio[campo] !== "") {
                faltanCampos.push(campo);
            }
        });
        
        if (faltanCampos.length > 0) {
            console.error('❌ Campos faltantes:', faltanCampos);
            throw new Error(`Campos faltantes: ${faltanCampos.join(', ')}`);
        }
        
        // MOSTRAR CONFIRMACIÓN
        const confirmMessage = `¿Confirmar registro de envío?\n\n📍 Destino: ${datosEnvio["CIUDAD DESTINO"]}\n👤 Cliente: ${datosEnvio["DESTINO"]}\n💰 Valor a recaudar: $${parseInt(datosEnvio["VALOR A RECAUDAR"]).toLocaleString()}`;
        
        if (!confirm(confirmMessage)) {
            // Si el usuario cancela, re-habilitar el botón
            submitButton.disabled = false;
            formularioEnviandose = false;
            submitButton.classList.remove('opacity-70', 'cursor-not-allowed');
            submitText.textContent = 'Registrar Envío';
            submitIcon.textContent = 'send';
            return;
        }
        
        console.log('📡 Enviando datos a Google Apps Script...');
        
        try {
            // Crear FormData con los nombres EXACTOS que espera GAS
            const formData = new FormData();
            
            // IMPORTANTE: Usar los nombres EXACTOS del array fila en GAS
            formData.append("envioId", datosEnvio["ENVIO ID"]);
            formData.append("formaPago", datosEnvio["FORMA DE PAGO"]);
            formData.append("remite", datosEnvio["REMITE"]);
            formData.append("telefono", datosEnvio["TELEFONO"]);
            formData.append("direccion", datosEnvio["DIRECCION"]);
            formData.append("ciudad", datosEnvio["CIUDAD"]);
            formData.append("destino", datosEnvio["DESTINO"]);
            formData.append("direccionDestino", datosEnvio["DIRECCION DESTINO"]);
            formData.append("barrio", datosEnvio["BARRIO"]);
            formData.append("telefonoCliente", datosEnvio["TELEFONOCLIENTE"]);
            formData.append("complementoDir", datosEnvio["COMPLEMENTO DE DIR"]);
            formData.append("ciudadDestino", datosEnvio["CIUDAD DESTINO"]);
            formData.append("valorRecaudar", datosEnvio["VALOR A RECAUDAR"]);
            formData.append("totalAPagar", datosEnvio["TOTAL A PAGAR"]);
            formData.append("pagadoRemitente", datosEnvio["PAGADO A REMITENTE"]);
            formData.append("correoRemitente", datosEnvio["CORREO REMITENTE"]);
            formData.append("usuarioId", datosEnvio["USUARIO ID"]);
            
            // Debug: Ver qué estamos enviando
            console.log('📤 Enviando FormData (con ID único):');
            for (let pair of formData.entries()) {
                console.log(`  ${pair[0]}: ${pair[1]}`);
            }
            
            // Enviar con fetch
            const response = await fetch(WEB_APP_URL, {
                method: 'POST',
                mode: 'no-cors',
                body: formData
            });
            
            console.log('📨 Respuesta recibida:', response);
            
            // ============================================
            // PASO 3: GUARDAR DATOS PARA LA GUÍA (CON EL MISMO ID)
            // ============================================
            const datosCompletosParaGuia = {
                ...datosEnvio,
                "ENVIO ID": idLocal,
                envioId: idLocal,
                // Guardar también los campos que usa guia.js
                formaPago: datosEnvio["FORMA DE PAGO"],
                remite: datosEnvio["REMITE"],
                telefono: datosEnvio["TELEFONO"],
                ciudad: datosEnvio["CIUDAD"],
                destino: datosEnvio["DESTINO"],
                telefonoCliente: datosEnvio["TELEFONOCLIENTE"],
                direccionDestino: datosEnvio["DIRECCION DESTINO"],
                barrio: datosEnvio["BARRIO"],
                complementoDir: datosEnvio["COMPLEMENTO DE DIR"],
                ciudadDestino: datosEnvio["CIUDAD DESTINO"],
                valorRecaudar: datosEnvio["VALOR A RECAUDAR"],
                totalAPagar: datosEnvio["TOTAL A PAGAR"]
            };

            // Guardar en localStorage para que guia.js lo encuentre
            localStorage.setItem('ultimoEnvioCompleto', JSON.stringify(datosCompletosParaGuia));
            
            // También guardar como respaldo
            guardarEnvioEnLocalStorage(datosEnvio);
            
            // MOSTRAR ÉXITO Y REDIRIGIR A GUÍA
            setTimeout(() => {
                mostrarResultadoExitoso(datosEnvio, idLocal);
            }, 500);
            
            // Toast breve informativo
            const successMessage = document.createElement('div');
            successMessage.className = 'fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg shadow-lg z-50';
            successMessage.innerHTML = `
                <div class="flex items-center">
                    <span class="material-icons mr-2">check_circle</span>
                    <span class="font-semibold">¡Envío registrado exitosamente!</span>
                </div>
                <div class="mt-2 text-sm">
                    ✅ Datos enviados al sistema con ID: ${idLocal}<br>
                    <span class="font-mono">Redirigiendo a la guía...</span>
                </div>
            `;
            document.body.appendChild(successMessage);
            
            // Ocultar mensaje después de 5 segundos
            setTimeout(() => {
                successMessage.remove();
            }, 5000);
            
            // Resetear formulario después de 3 segundos
            setTimeout(() => {
                resetearFormulario();
                formularioEnviandose = false;
            }, 3000);
            
        } catch (fetchError) {
            console.error('❌ Error en el envío:', fetchError);
            
            // AUN ASÍ GUARDAR LOCALMENTE Y REDIRIGIR
            const datosCompletosParaGuia = {
                ...datosEnvio,
                "ENVIO ID": idLocal,
                envioId: idLocal
            };

            localStorage.setItem('ultimoEnvioCompleto', JSON.stringify(datosCompletosParaGuia));
            guardarEnvioEnLocalStorage(datosEnvio);
            
            setTimeout(() => {
                mostrarResultadoExitoso(datosEnvio, idLocal);
            }, 500);
            
            // Mostrar mensaje de error amigable
            const errorMessage = document.createElement('div');
            errorMessage.className = 'fixed top-4 right-4 bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded-lg shadow-lg z-50';
            errorMessage.innerHTML = `
                <div class="flex items-center">
                    <span class="material-icons mr-2">warning</span>
                    <span class="font-semibold">Envío guardado localmente</span>
                </div>
                <div class="mt-2 text-sm">
                    ⚠️ Problema de conexión con el servidor.<br>
                    <span class="font-mono">Los datos se guardaron con ID: ${idLocal}</span>
                </div>
            `;
            document.body.appendChild(errorMessage);
            
            // Ocultar mensaje después de 5 segundos
            setTimeout(() => {
                errorMessage.remove();
            }, 5000);
            
            // Rehabilitar botón
            submitButton.disabled = false;
            formularioEnviandose = false;
            submitButton.classList.remove('opacity-70', 'cursor-not-allowed');
            submitText.textContent = 'Registrar Envío';
            submitIcon.textContent = 'send';
            
            // Resetear formulario después de 3 segundos
            setTimeout(() => {
                resetearFormulario();
            }, 3000);
        }
        
    } catch (error) {
        console.error('❌ Error crítico en el envío:', error);
        
        // Mostrar mensaje de error
        alert(`Error: ${error.message}\n\nPor favor intenta nuevamente.`);
        
        // Rehabilitar botón
        submitButton.disabled = false;
        formularioEnviandose = false;
        submitButton.classList.remove('opacity-70', 'cursor-not-allowed');
        submitText.textContent = 'Registrar Envío';
        submitIcon.textContent = 'send';
    }
}

function guardarEnvioEnLocalStorage(datosEnvio) {
    try {
        // Guardar en localStorage como respaldo
        const enviosGuardados = JSON.parse(localStorage.getItem('enviosPendientes')) || [];
        enviosGuardados.push({
            ...datosEnvio,
            fechaGuardado: new Date().toISOString(),
            sincronizado: false
        });
        
        localStorage.setItem('enviosPendientes', JSON.stringify(enviosGuardados));
        console.log('💾 Envío guardado en localStorage:', datosEnvio["ENVIO ID"]);
        
    } catch (error) {
        console.error('Error guardando en localStorage:', error);
    }
}

// ============================================
// FUNCIONES AUXILIARES
// ============================================

function getDefaultBarrios() {
    return [
        { id: "ATB6ZXHU", nombre: "USAQUÉN-SANTA BARBARA ORIENTAL" },
        { id: "1HOGOY32", nombre: "USAQUÉN-SANTA BARBARA CENTRAL" },
        { id: "WYWRDLUX", nombre: "USAQUÉN-CHICO NORTE II SECTOR" },
        { id: "5TKZNTB2", nombre: "USAQUÉN-SANTA BARBARA OCCIDENTAL" },
        { id: "5DUKSNR5", nombre: "USAQUÉN-SAN PATRICIO" }
    ];
}

function validarFormulario() {
    let valido = true;
    
    // Lista de campos requeridos
    const camposRequeridos = [
        'remitente',
        'telefonoRemitente',
        'direccionRemitente',
        'destinatario',
        'direccionDestino',
        'telefonoCliente',
        'barrioLocalidad',
        'ciudadDestino'
    ];
    
    // Validar cada campo
    camposRequeridos.forEach(id => {
        const campo = document.getElementById(id);
        if (campo && !campo.value.trim()) {
            campo.classList.add('invalid');
            valido = false;
        } else if (campo) {
            campo.classList.remove('invalid');
        }
    });
    
    // Validar valor a recaudar si es contraentrega
    const formaPago = document.getElementById('formaPago').value;
    const valorRecaudar = document.getElementById('valorRecaudar');
    
    if ((formaPago === 'contraentrega' || formaPago === 'contraentrega_recaudo') && 
        (!valorRecaudar.value || parseFloat(valorRecaudar.value) <= 0)) {
        valorRecaudar.classList.add('invalid');
        valido = false;
    }
    
    return valido;
}

function resetearFormulario() {
    // Resetear campos del formulario
    const deliveryForm = document.getElementById('deliveryForm');
    if (deliveryForm) deliveryForm.reset();
    
    // Resetear campos ocultos
    if (barrioIdInput) barrioIdInput.value = '';
    
    // Resetear selección de pago
    const paymentOptions = document.querySelectorAll('.payment-option');
    paymentOptions.forEach(opt => opt.classList.remove('selected'));
    if (paymentOptions[0]) {
        paymentOptions[0].click();
    }
    
    // Resetear estilos de validación
    document.querySelectorAll('.invalid').forEach(el => {
        el.classList.remove('invalid');
    });
    
    // IMPORTANTE: Restaurar estado de envío
    formularioEnviandose = false;
    
    // Restaurar información del usuario si es cliente
    const usuario = JSON.parse(localStorage.getItem("usuarioLogueado"));
    if (usuario && usuario.ROL === "CLIENTE") {
        const remitente = document.getElementById('remitente');
        const direccionRemitente = document.getElementById('direccionRemitente');
        const telefonoRemitente = document.getElementById('telefonoRemitente');
        
        if (remitente) remitente.value = usuario["NOMBRE REMITENTE"] || usuario["NOMBRE COMPLETO"] || "";
        if (direccionRemitente) direccionRemitente.value = usuario["DIRECCION REMITENTE"] || "";
        if (telefonoRemitente) telefonoRemitente.value = usuario["TELEFONO REMITENTE"] || usuario["TELEFONO"] || "";
    }
    
    // Restaurar botón de envío
    const submitButton = document.getElementById('submitButton');
    const submitText = document.getElementById('submitText');
    const submitIcon = document.getElementById('submitIcon');
    
    if (submitButton) {
        submitButton.disabled = false;
        submitButton.classList.remove('opacity-70', 'cursor-not-allowed');
    }
    if (submitText) submitText.textContent = 'Registrar Envío';
    if (submitIcon) submitIcon.textContent = 'send';
    
    // Actualizar resumen
    actualizarResumen();
    
    // Enfocar primer campo editable
    const primerCampo = usuario && usuario.ROL === "CLIENTE" 
        ? document.getElementById('destinatario') 
        : document.getElementById('remitente');
    
    if (primerCampo) primerCampo.focus();
}

function handleCancel() {
    if (confirm('¿Cancelar? Se perderán los datos.')) {
        resetearFormulario();
    }
}

// ============================================
// FUNCIONES PARA RESULTADO Y GUÍA
// ============================================

function mostrarResultadoExitoso(datosEnvio, idGenerado) {
    console.log('🎉 Mostrando resultado exitoso con ID:', idGenerado);
    
    // Ocultar formulario
    const deliveryForm = document.getElementById('deliveryForm');
    if (deliveryForm) {
        deliveryForm.style.display = 'none';
    }
    
    // Mostrar sección de resultado
    const resultSection = document.getElementById('resultSection');
    if (resultSection) {
        resultSection.classList.remove('hidden');
        
        // Actualizar datos en la sección de resultado
        const resultGuideNumber = document.getElementById('resultGuideNumber');
        const resultDestinatario = document.getElementById('resultDestinatario');
        const resultValor = document.getElementById('resultValor');
        const resultMessage = document.getElementById('resultMessage');
        
        if (resultGuideNumber) {
            resultGuideNumber.textContent = idGenerado;
        }
        
        if (resultDestinatario) {
            resultDestinatario.textContent = datosEnvio["DESTINO"] || "No especificado";
        }
        
        if (resultValor) {
            const valor = parseFloat(datosEnvio["VALOR A RECAUDAR"]) || 0;
            resultValor.textContent = `$${valor.toLocaleString()}`;
        }
        
        if (resultMessage) {
            resultMessage.textContent = `Guía ${idGenerado} generada exitosamente. Puedes imprimir la guía para el mensajero.`;
        }
        
        // ============================================
        // CAMBIO IMPORTANTE: Auto-redirección después de 2 segundos
        // ============================================
        setTimeout(() => {
            abrirGuiaAutomatically(idGenerado, datosEnvio);
        }, 2000);
        
        // Configurar botón "Imprimir Guía"
        const printGuideBtn = document.getElementById('printGuideBtn');
        if (printGuideBtn) {
            printGuideBtn.replaceWith(printGuideBtn.cloneNode(true));
            const newPrintGuideBtn = document.getElementById('printGuideBtn');
            newPrintGuideBtn.addEventListener('click', function() {
                // Usar la misma función para consistencia
                abrirGuiaAutomatically(idGenerado, datosEnvio);
            });
        }
        
        // Configurar botón "Nuevo Envío"
        const newDeliveryBtn = document.getElementById('newDeliveryBtn');
        if (newDeliveryBtn) {
            // Remover cualquier listener anterior
            newDeliveryBtn.replaceWith(newDeliveryBtn.cloneNode(true));
            
            // Obtener el nuevo elemento
            const newNewDeliveryBtn = document.getElementById('newDeliveryBtn');
            newNewDeliveryBtn.addEventListener('click', function() {
                // Ocultar resultado y mostrar formulario
                resultSection.classList.add('hidden');
                if (deliveryForm) {
                    deliveryForm.style.display = 'block';
                    resetearFormulario();
                }
            });
        }
        
        // Guardar el ID para imprimir la guía
        localStorage.setItem('envioParaGuia', idGenerado);
    }
}

// ============================================
// FUNCIÓN PARA ABRIR GUIA AUTOMÁTICAMENTE
// ============================================
function abrirGuiaAutomatically(idGenerado, datosEnvio) {
    console.log('📄 Abriendo guía automáticamente:', idGenerado);
    
    // Guardar el ID con el nombre CORRECTO que espera guia.js
    localStorage.setItem('envioParaGuia', idGenerado);
    
    // También guardar los datos completos por si acaso
    localStorage.setItem('guiaDatosCompletos', JSON.stringify({
        datos: datosEnvio,
        timestamp: new Date().getTime()
    }));
    
    // Limpiar la clave anterior para evitar confusiones
    localStorage.removeItem('ultimoEnvioId');
    
    // Abrir guia.html en una nueva pestaña
    const nuevaVentana = window.open('guia.html', '_blank');
    
    if (!nuevaVentana) {
        // Si el navegador bloquea ventanas emergentes, mostrar instrucciones
        alert('Por favor, haz clic en "Imprimir Guía" para ver la guía de envío.');
    }
}

// ============================================
// FUNCIÓN PARA GENERAR ID LOCAL (MEJORADA)
// ============================================
function generarIDLocal() {
    const ahora = new Date();
    const año = ahora.getFullYear().toString().slice(-2);
    const mes = (ahora.getMonth() + 1).toString().padStart(2, '0');
    const dia = ahora.getDate().toString().padStart(2, '0');
    const hora = ahora.getHours().toString().padStart(2, '0');
    const minutos = ahora.getMinutes().toString().padStart(2, '0');
    const segundos = ahora.getSeconds().toString().padStart(2, '0');
    
    // Usar solo 4 dígitos para milisegundos (en lugar de 3)
    const milisegundos = ahora.getMilliseconds().toString().padStart(4, '0').slice(0, 4);
    
    return `ENV${año}${mes}${dia}${hora}${minutos}${segundos}${milisegundos}`;
}

// ============================================
// FUNCIÓN PARA MOSTRAR/OCULTAR BOTÓN ADMIN
// ============================================
function configurarBotonesAdmin() {
    try {
        const usuarioLogueado = JSON.parse(localStorage.getItem('usuarioLogueado'));
        
        if (!usuarioLogueado) {
            console.log('⚠️ Usuario no autenticado');
            return;
        }
        
        const adminButton = document.getElementById('adminPlanillaButton');
        const nombreUsuario = document.getElementById('nombreUsuario');
        const rolUsuario = document.getElementById('rolUsuario');
        
        // Actualizar información del usuario
        if (nombreUsuario) {
            nombreUsuario.textContent = usuarioLogueado.USUARIO || 'Usuario';
        }
        
        if (rolUsuario) {
            const rol = usuarioLogueado.ROL || 'Usuario';
            rolUsuario.textContent = rol;
            
            // Destacar si es ADMIN
            if (rol === 'ADMIN') {
                rolUsuario.classList.add('font-bold', 'text-purple-600', 'dark:text-purple-400');
            }
        }
        
        // Mostrar botón de admin si el rol es ADMIN
        if (usuarioLogueado.ROL === 'ADMIN' && adminButton) {
            adminButton.classList.remove('hidden');
            console.log('✅ Mostrando botón de Planillas Mensajeros para ADMIN:', usuarioLogueado.USUARIO);
            
            // Agregar evento click al botón
            adminButton.addEventListener('click', function(e) {
                e.preventDefault();
                console.log('🔗 Redirigiendo a planilla-mensajeros.html');
                window.location.href = 'planilla-mensajeros.html';
            });
        } else if (adminButton) {
            // Ocultar completamente si no es admin
            adminButton.style.display = 'none';
        }
        
    } catch (error) {
        console.error('❌ Error configurando botones admin:', error);
    }
}

// ============================================
// FUNCIÓN PARA EL BOTÓN DE HISTORIAL
// ============================================
function configurarBotonHistorial() {
    const historialButton = document.getElementById('historialButton');
    
    if (historialButton) {
        historialButton.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = 'historial.html';
        });
    }
}

// ============================================
// INICIALIZACIÓN PRINCIPAL
// ============================================

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM cargado - Iniciando aplicación');
    
    // Agregar animaciones CSS primero
    agregarAnimacionesCSS();
    
    // Ocultar la intro rápidamente
    setTimeout(() => {
        const intro = document.getElementById('intro');
        if (intro) intro.style.display = 'none';
    }, 1500);
    
    // Primero verificar sesión
    const sesionValida = verificarSesionYConfigurarUI();
    
    if (sesionValida) {
        // Luego inicializar la app
        setTimeout(() => {
            initApp();
        }, 100);
    }
    
    // Configurar botones adicionales
    configurarBotonesAdmin();
    configurarBotonHistorial();
});

