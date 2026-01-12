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
// GOOGLE PLACES AUTOCOMPLETE - MEJORADO PARA BOGOTÁ
// ============================================

function inicializarGooglePlacesAutocomplete() {
    console.log("📍 Inicializando Google Places Autocomplete MEJORADO para Bogotá...");
    
    const direccionInput = document.getElementById('direccionDestino');
    const barrioInput = document.getElementById('barrioLocalidad');
    const ciudadDestinoSelect = document.getElementById('ciudadDestino');
    
    if (!direccionInput) {
        console.error("❌ No se encontró el campo 'direccionDestino'");
        return;
    }
    
    // ============================================
    // VERIFICAR SI GOOGLE MAPS ESTÁ DISPONIBLE
    // ============================================
    if (typeof google === 'undefined') {
        console.error("❌ Google Maps no está disponible");
        mostrarErrorGoogleMapsFatal();
        return;
    }
    
    if (!google.maps || !google.maps.places) {
        console.error("❌ Google Places API no está disponible");
        mostrarErrorGoogleMapsFatal();
        return;
    }
    
    try {
        // ============================================
        // CONFIGURACIÓN ESPECÍFICA PARA BOGOTÁ/COLOMBIA
        // ============================================
        const autocomplete = new google.maps.places.Autocomplete(direccionInput, {
            componentRestrictions: { 
                country: 'co',
                // Restringir a Bogotá y Soacha principalmente
                // locality: ['Bogotá', 'Soacha']
            },
            fields: [
                'address_components', 
                'formatted_address', 
                'geometry', 
                'name',
                'types',
                'place_id'
            ],
            types: ['address', 'establishment'],  // Aceptar direcciones y establecimientos
            bounds: new google.maps.LatLngBounds(
                new google.maps.LatLng(4.482, -74.221), // Suroeste
                new google.maps.LatLng(4.838, -74.021)  // Noreste (área Bogotá)
            )
        });
        
        console.log("✅ Autocomplete creado exitosamente para Bogotá/Soacha");
        
        // Deshabilitar autocomplete nativo
        direccionInput.setAttribute('autocomplete', 'off');
        
        // ============================================
        // EVENTO MEJORADO PARA DETECCIÓN PRECISA
        // ============================================
        autocomplete.addListener('place_changed', function() {
            const place = autocomplete.getPlace();
            
            if (!place.geometry) {
                console.log("⚠️ Usuario no seleccionó de la lista");
                // Si el usuario escribió manualmente, intentar extraer barrio del texto
                if (direccionInput.value.trim() && barrioInput) {
                    extraerBarrioDeTexto(direccionInput.value, barrioInput);
                }
                return;
            }
            
            console.log("📍 Lugar seleccionado:", {
                direccion: place.formatted_address,
                tipos: place.types,
                componentes: place.address_components,
                nombre: place.name
            });
            
            // Guardar datos globalmente
            window.ultimaDireccionSeleccionada = {
                direccion_completa: place.formatted_address,
                latitud: place.geometry.location.lat(),
                longitud: place.geometry.location.lng(),
                nombre_lugar: place.name || '',
                place_id: place.place_id || ''
            };
            
            // ============================================
            // EXTRACCIÓN MEJORADA DE BARRIO PARA BOGOTÁ
            // ============================================
            if (barrioInput) {
                let barrioEncontrado = '';
                let localidadEncontrada = '';
                
                // Estrategias de extracción en orden de prioridad
                
                // 1. Buscar en los componentes de la dirección
                if (place.address_components && place.address_components.length > 0) {
                    console.log("🔍 Buscando barrio en componentes:", place.address_components);
                    
                    place.address_components.forEach(component => {
                        const tipos = component.types;
                        
                        // Prioridad 1: neighborhood (barrio oficial en Google)
                        if (tipos.includes('neighborhood')) {
                            barrioEncontrado = component.long_name;
                            console.log(`✅ Barrio encontrado (neighborhood): ${barrioEncontrado}`);
                        }
                        // Prioridad 2: sublocality (sub-localidad, común en Bogotá)
                        else if ((tipos.includes('sublocality') || tipos.includes('sublocality_level_1') || 
                                 tipos.includes('sublocality_level_2')) && !barrioEncontrado) {
                            barrioEncontrado = component.long_name;
                            console.log(`✅ Barrio encontrado (sublocality): ${barrioEncontrado}`);
                        }
                        // Prioridad 3: administrative_area_level_3 (localidad)
                        else if (tipos.includes('administrative_area_level_3') && !localidadEncontrada) {
                            localidadEncontrada = component.long_name;
                        }
                        // Prioridad 4: route (calle/carrera) - puede contener barrio en el nombre
                        else if (tipos.includes('route') && !barrioEncontrado) {
                            const nombreVia = component.long_name.toLowerCase();
                            // Verificar si el nombre de la vía contiene barrio
                            if (nombreVia.includes('kr') || nombreVia.includes('cl') || 
                                nombreVia.includes('dg') || nombreVia.includes('av') ||
                                nombreVia.includes('ak') || nombreVia.includes('ac')) {
                                // Extraer posible barrio del nombre de la vía
                                const partes = component.long_name.split(' ');
                                if (partes.length > 2) {
                                    // Tomar la última parte como posible barrio
                                    barrioEncontrado = partes[partes.length - 1];
                                    console.log(`✅ Posible barrio de vía: ${barrioEncontrado}`);
                                }
                            }
                        }
                    });
                }
                
                // 2. Si no se encontró barrio en componentes, intentar extraer del nombre del lugar
                if (!barrioEncontrado && place.name) {
                    barrioEncontrado = extraerBarrioDeNombreLugar(place.name);
                    if (barrioEncontrado) {
                        console.log(`✅ Barrio extraído del nombre: ${barrioEncontrado}`);
                    }
                }
                
                // 3. Si aún no se encontró, intentar extraer del texto completo de la dirección
                if (!barrioEncontrado) {
                    barrioEncontrado = extraerBarrioDeTexto(place.formatted_address, null);
                    if (barrioEncontrado) {
                        console.log(`✅ Barrio extraído del texto: ${barrioEncontrado}`);
                    }
                }
                
                // 4. Si encontramos localidad pero no barrio, usar la localidad
                if (!barrioEncontrado && localidadEncontrada) {
                    barrioEncontrado = localidadEncontrada;
                    console.log(`✅ Usando localidad como barrio: ${barrioEncontrado}`);
                }
                
                // Asignar barrio si se encontró
                if (barrioEncontrado) {
                    // Limpiar el nombre del barrio
                    barrioEncontrado = limpiarNombreBarrio(barrioEncontrado);
                    
                    barrioInput.value = barrioEncontrado;
                    console.log(`🎯 Barrio asignado: ${barrioEncontrado}`);
                    
                    // Buscar coincidencia en datos de barrios
                    buscarBarrioEnDatos(barrioEncontrado);
                    
                    // Disparar eventos para actualizar UI
                    barrioInput.dispatchEvent(new Event('input', { bubbles: true }));
                    barrioInput.dispatchEvent(new Event('change', { bubbles: true }));
                } else {
                    console.log("⚠️ No se detectó barrio automáticamente");
                    // Sugerir al usuario que ingrese el barrio manualmente
                    mostrarSugerenciaBarrioManual();
                }
            }
            
            // ============================================
            // DETECCIÓN MEJORADA DE CIUDAD
            // ============================================
            if (ciudadDestinoSelect) {
                let ciudadDetectada = '';
                
                place.address_components.forEach(component => {
                    const tipos = component.types;
                    
                    // Buscar ciudad (locality)
                    if (tipos.includes('locality')) {
                        ciudadDetectada = component.long_name;
                    }
                    // Si no encuentra locality, buscar administrative_area_level_2
                    else if (!ciudadDetectada && tipos.includes('administrative_area_level_2')) {
                        ciudadDetectada = component.long_name;
                    }
                });
                
                // Normalizar nombre de ciudad para Bogotá
                if (ciudadDetectada) {
                    ciudadDetectada = ciudadDetectada.replace('Bogota', 'Bogotá')
                                                     .replace('BOGOTA', 'Bogotá')
                                                     .replace('bogota', 'Bogotá');
                    
                    // Buscar coincidencia en opciones
                    let ciudadSeleccionada = '';
                    Array.from(ciudadDestinoSelect.options).forEach(option => {
                        if (option.value) {
                            const optionLower = option.value.toLowerCase();
                            const detectadaLower = ciudadDetectada.toLowerCase();
                            
                            // Comparaciones flexibles
                            if (optionLower.includes(detectadaLower) || 
                                detectadaLower.includes(optionLower) ||
                                (detectadaLower.includes('bogotá') && optionLower.includes('bogotá')) ||
                                (detectadaLower.includes('soacha') && optionLower.includes('soacha'))) {
                                ciudadSeleccionada = option.value;
                            }
                        }
                    });
                    
                    if (ciudadSeleccionada) {
                        ciudadDestinoSelect.value = ciudadSeleccionada;
                        ciudadDestinoSelect.dispatchEvent(new Event('change', { bubbles: true }));
                        console.log(`✅ Ciudad detectada y seleccionada: ${ciudadSeleccionada}`);
                    } else {
                        console.log(`⚠️ Ciudad detectada pero no en opciones: ${ciudadDetectada}`);
                    }
                }
            }
            
            // ============================================
            // MEJORAR EL TEXTO DE LA DIRECCIÓN
            // ============================================
            if (place.formatted_address) {
                // Simplificar dirección si es muy larga
                let direccionSimplificada = place.formatted_address;
                
                // Remover repetidos como "Bogotá, Bogotá, Colombia"
                direccionSimplificada = direccionSimplificada.replace(/(Bogotá,?\s*){2,}/gi, 'Bogotá, ');
                direccionSimplificada = direccionSimplificada.replace(/(Soacha,?\s*){2,}/gi, 'Soacha, ');
                
                // Actualizar campo
                direccionInput.value = direccionSimplificada;
                
                // Mostrar notificación
                mostrarNotificacionSimple(`✅ Dirección encontrada: ${direccionSimplificada.substring(0, 50)}...`);
            }
            
            // Enfocar siguiente campo
            setTimeout(() => {
                const complementoInput = document.getElementById('complementoDireccion');
                if (complementoInput) {
                    complementoInput.focus();
                    // Sugerir complemento basado en el lugar
                    sugerirComplementoDireccion(place);
                }
            }, 300);
        });
        
        // ============================================
        // EVENTOS ADICIONALES PARA MEJORAR LA EXPERIENCIA
        // ============================================
        
        // Cuando el usuario empieza a escribir
        direccionInput.addEventListener('input', function(e) {
            // Si el usuario borra y empieza a escribir de nuevo, limpiar barrio
            if (barrioInput && this.value.length < 3) {
                barrioInput.value = '';
            }
            
            // Si el usuario escribe "cll", "cra", "av", etc, sugerir formato
            const texto = this.value.toLowerCase();
            if (texto.includes('cll') || texto.includes('cra') || 
                texto.includes('diag') || texto.includes('av') ||
                texto.includes('trans') || texto.includes('ak')) {
                mostrarSugerenciaFormatoDireccion();
            }
        });
        
        // Cuando el usuario presiona Enter sin seleccionar
        direccionInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                
                // Si no hay selección del dropdown, intentar extraer barrio del texto
                if (barrioInput && this.value.trim() && !window.ultimaDireccionSeleccionada) {
                    const barrioExtraido = extraerBarrioDeTexto(this.value, barrioInput);
                    if (barrioExtraido) {
                        console.log(`✅ Barrio extraído al presionar Enter: ${barrioExtraido}`);
                    }
                }
            }
        });
        
        // Cuando el campo pierde el foco
        direccionInput.addEventListener('blur', function() {
            // Pequeño delay para permitir que se procese la selección del dropdown
            setTimeout(() => {
                // Si no se seleccionó nada del dropdown pero hay texto
                if (this.value.trim() && barrioInput && !barrioInput.value && !window.ultimaDireccionSeleccionada) {
                    console.log("🔍 Campo perdió foco - intentando extraer barrio del texto");
                    extraerBarrioDeTexto(this.value, barrioInput);
                }
            }, 500);
        });
        
        console.log("✅ Google Places inicializado correctamente con mejoras para Bogotá");
        
    } catch (error) {
        console.error("❌ Error en Google Places:", error);
        mostrarErrorGoogleMaps();
    }
}

// ============================================
// FUNCIONES AUXILIARES PARA EXTRACCIÓN DE BARRIOS
// ============================================

function extraerBarrioDeTexto(texto, barrioInputElement) {
    if (!texto || !texto.trim()) return null;
    
    console.log(`🔍 Extrayendo barrio de texto: "${texto.substring(0, 50)}..."`);
    
    const textoLower = texto.toLowerCase();
    let barrioEncontrado = '';
    
    // Lista de palabras clave que indican barrios en Bogotá
    const palabrasClaveBarrios = [
        // Localidades de Bogotá
        'usaquén', 'chapinero', 'santa fe', 'san cristóbal', 'usme',
        'tunjuelito', 'bosa', 'kennedy', 'fontibón', 'engativá',
        'suba', 'barrios unidos', 'teusaquillo', 'los mártires',
        'antonio nariño', 'puente aranda', 'candelaria', 'rafael uribe',
        
        // Barrios comunes
        'modelia', 'timiza', 'tibaná', 'patio bonito', 'quiroga',
        'alquería', 'la fragua', 'ciudad jardín', 'normandía',
        'muzú', 'las cruces', 'belén', 'la perseverancia',
        'la macarena', 'la candelaria', 'la soledad', 'la esquina',
        'las aguas', 'la victoria', 'las ferias',
        
        // Soacha
        'soacha', 'ciudad verde', 'parques de bogotá', 'san mateo',
        'san hilarion', 'san miguel', 'san juan', 'san pablo'
    ];
    
    // Patrones comunes en direcciones de Bogotá
    const patrones = [
        // Patrón: Calle/Cra XX # YY - ZZ (Barrio)
        /(?:cll|cra|av|diag|trans|ak|ac)\s*\d+\s*[#\-]\s*\d+\s*[-\w]+\s*[-–]\s*([\w\sáéíóúñ]+)/i,
        
        // Patrón: En el barrio XXXXX
        /(?:barrio|brr|br|sector|localidad|zona)\s+([\w\sáéíóúñ]+)/i,
        
        // Patrón: Entre calles XX y YY - Barrio ZZZ
        /entre\s+[\w\s]+\s+y\s+[\w\s]+\s*[-–]\s*(?:barrio\s+)?([\w\sáéíóúñ]+)/i,
        
        // Direcciones que terminan con barrio
        /,\s*([\w\sáéíóúñ]+)(?:,\s*(?:bogotá|soacha|colombia))?$/i
    ];
    
    // 1. Buscar por palabras clave
    for (const palabra of palabrasClaveBarrios) {
        if (textoLower.includes(palabra)) {
            // Encontrar la palabra exacta con mayúsculas
            const regex = new RegExp(palabra, 'i');
            const match = texto.match(regex);
            if (match) {
                barrioEncontrado = match[0];
                // Capitalizar primera letra de cada palabra
                barrioEncontrado = barrioEncontrado.split(' ')
                    .map(pal => pal.charAt(0).toUpperCase() + pal.slice(1).toLowerCase())
                    .join(' ');
                break;
            }
        }
    }
    
    // 2. Si no encontró por palabras clave, probar patrones
    if (!barrioEncontrado) {
        for (const patron of patrones) {
            const match = texto.match(patron);
            if (match && match[1]) {
                barrioEncontrado = match[1].trim();
                // Limpiar
                barrioEncontrado = barrioEncontrado.replace(/,$/, '')
                                                   .replace(/^en\s+/i, '')
                                                   .replace(/^el\s+/i, '')
                                                   .replace(/^la\s+/i, '')
                                                   .replace(/^los\s+/i, '')
                                                   .replace(/^las\s+/i, '');
                break;
            }
        }
    }
    
    // 3. Buscar en los datos de barrios si tenemos acceso
    if (!barrioEncontrado && window.barriosData && window.barriosData.length > 0) {
        for (const barrio of window.barriosData) {
            if (barrio.nombre && textoLower.includes(barrio.nombre.toLowerCase())) {
                barrioEncontrado = barrio.nombre;
                break;
            }
        }
    }
    
    // Si encontramos un barrio
    if (barrioEncontrado) {
        barrioEncontrado = limpiarNombreBarrio(barrioEncontrado);
        console.log(`✅ Barrio extraído del texto: "${barrioEncontrado}"`);
        
        if (barrioInputElement) {
            barrioInputElement.value = barrioEncontrado;
            
            // Buscar coincidencia en datos
            buscarBarrioEnDatos(barrioEncontrado);
            
            // Disparar eventos
            barrioInputElement.dispatchEvent(new Event('input', { bubbles: true }));
            barrioInputElement.dispatchEvent(new Event('change', { bubbles: true }));
            
            mostrarNotificacionSimple(`📍 Barrio detectado: ${barrioEncontrado}`);
        }
        
        return barrioEncontrado;
    }
    
    console.log("⚠️ No se pudo extraer barrio del texto");
    return null;
}

function extraerBarrioDeNombreLugar(nombreLugar) {
    if (!nombreLugar) return null;
    
    const nombreLower = nombreLugar.toLowerCase();
    
    // Lugares que suelen incluir el barrio en el nombre
    const patronesLugar = [
        // Ej: "Centro Comercial Unicentro - Usaquén"
        /[-–]\s*([\w\sáéíóúñ]+)$/i,
        
        // Ej: "Éxito Calle 80 (Fontibón)"
        /\(([\w\sáéíóúñ]+)\)$/i,
        
        // Ej: "Clínica San Rafael, Chapinero"
        /,\s*([\w\sáéíóúñ]+)$/i,
        
        // Ej: "Colegio Distrital Juan Pablo II - Bosa"
        /\s+en\s+([\w\sáéíóúñ]+)$/i
    ];
    
    for (const patron of patronesLugar) {
        const match = nombreLugar.match(patron);
        if (match && match[1]) {
            const posibleBarrio = match[1].trim();
            // Verificar que no sea una palabra genérica
            if (!esPalabraGenerica(posibleBarrio)) {
                return limpiarNombreBarrio(posibleBarrio);
            }
        }
    }
    
    return null;
}

function buscarBarrioEnDatos(nombreBarrio) {
    if (!nombreBarrio || !window.barriosData || window.barriosData.length === 0) return null;
    
    const barrioLower = nombreBarrio.toLowerCase();
    
    // Buscar coincidencia exacta o parcial
    for (const barrio of window.barriosData) {
        if (barrio.nombre && barrio.nombre.toLowerCase().includes(barrioLower)) {
            console.log(`✅ Coincidencia encontrada en datos: ${barrio.nombre} (ID: ${barrio.id})`);
            
            // Actualizar campo de ID de barrio si existe
            const barrioIdInput = document.getElementById('barrioId');
            if (barrioIdInput && barrio.id) {
                barrioIdInput.value = barrio.id;
            }
            
            return barrio;
        }
    }
    
    // Si no encuentra, buscar por similitud
    const barriosSimilares = window.barriosData.filter(barrio => 
        barrio.nombre && calcularSimilitud(barrio.nombre.toLowerCase(), barrioLower) > 0.7
    );
    
    if (barriosSimilares.length > 0) {
        const mejorBarrio = barriosSimilares[0];
        console.log(`✅ Barrio similar encontrado: ${mejorBarrio.nombre}`);
        
        const barrioIdInput = document.getElementById('barrioId');
        if (barrioIdInput && mejorBarrio.id) {
            barrioIdInput.value = mejorBarrio.id;
        }
        
        return mejorBarrio;
    }
    
    return null;
}

function limpiarNombreBarrio(nombre) {
    if (!nombre) return '';
    
    return nombre
        .trim()
        .replace(/^barrio\s+/i, '')
        .replace(/^brr?\s*/i, '')
        .replace(/^sector\s+/i, '')
        .replace(/^localidad\s+/i, '')
        .replace(/^zona\s+/i, '')
        .replace(/\s+\(.*?\)$/, '') // Remover paréntesis al final
        .replace(/,\s*$/, '') // Remover coma al final
        .split(' ') // Capitalizar cada palabra
        .map(palabra => {
            if (palabra.length <= 2) return palabra.toLowerCase(); // De, la, el, etc
            return palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase();
        })
        .join(' ');
}

function esPalabraGenerica(texto) {
    const genericas = [
        'centro', 'norte', 'sur', 'oriente', 'occidente',
        'comercial', 'tienda', 'almacén', 'supermercado',
        'clínica', 'hospital', 'colegio', 'universidad',
        'estación', 'parque', 'plaza', 'avenida', 'calle',
        'carrera', 'diagonal', 'transversal', 'ak', 'ac',
        'edificio', 'torre', 'conjunto', 'residencial'
    ];
    
    const textoLower = texto.toLowerCase();
    return genericas.some(palabra => 
        textoLower === palabra || 
        new RegExp(`\\b${palabra}\\b`).test(textoLower)
    );
}

function calcularSimilitud(str1, str2) {
    // Algoritmo simple de similitud
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    return (longer.length - distanciaLevenshtein(longer, shorter)) / parseFloat(longer.length);
}

function distanciaLevenshtein(a, b) {
    const matrix = [];
    
    // Inicializar matriz
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    
    // Calcular distancia
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // sustitución
                    matrix[i][j - 1] + 1,     // inserción
                    matrix[i - 1][j] + 1      // eliminación
                );
            }
        }
    }
    
    return matrix[b.length][a.length];
}

function sugerirComplementoDireccion(place) {
    const complementoInput = document.getElementById('complementoDireccion');
    if (!complementoInput) return;
    
    let sugerencias = [];
    
    // Basado en el tipo de lugar
    if (place.types) {
        if (place.types.includes('establishment') || place.types.includes('point_of_interest')) {
            if (place.types.includes('store') || place.types.includes('shopping_mall')) {
                sugerencias = ['Tienda', 'Local comercial', 'Centro comercial'];
            } else if (place.types.includes('hospital') || place.types.includes('doctor')) {
                sugerencias = ['Consultorio', 'Clínica', 'Hospital'];
            } else if (place.types.includes('school') || place.types.includes('university')) {
                sugerencias = ['Colegio', 'Universidad', 'Institución educativa'];
            } else if (place.types.includes('apartment') || place.types.includes('residence')) {
                sugerencias = ['Apartamento', 'Conjunto residencial', 'Edificio'];
            }
        }
    }
    
    // Si es una casa o dirección residencial
    if (place.formatted_address && 
        (place.formatted_address.toLowerCase().includes('casa') ||
         place.formatted_address.toLowerCase().includes('apartamento') ||
         place.formatted_address.toLowerCase().includes('edificio'))) {
        sugerencias = ['Casa', 'Apartamento', 'Unidad residencial'];
    }
    
    // Si hay sugerencias, mostrarlas como placeholder
    if (sugerencias.length > 0) {
        complementoInput.placeholder = `Ej: ${sugerencias[0]}`;
        complementoInput.title = `Sugerencias: ${sugerencias.join(', ')}`;
    }
}

// ============================================
// FUNCIONES DE NOTIFICACIÓN Y UI
// ============================================

function mostrarErrorGoogleMapsFatal() {
    console.error("❌ ERROR FATAL: Google Maps no está disponible");
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-lg z-50 max-w-md';
    errorDiv.innerHTML = `
        <div class="flex items-center">
            <span class="material-symbols-outlined mr-2">error</span>
            <strong class="font-bold">Google Maps no disponible</strong>
        </div>
        <div class="mt-2 text-sm">
            <p>El autocompletado de direcciones no funcionará.</p>
            <p class="mt-1"><strong>Solución:</strong> Ingresa la dirección manualmente.</p>
            <p class="mt-1 text-xs">Formato sugerido: "Calle 123 # 45-67, Barrio Los Rosales, Bogotá"</p>
        </div>
    `;
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        if (errorDiv.parentElement) errorDiv.remove();
    }, 10000);
}

function mostrarSugerenciaBarrioManual() {
    const barrioInput = document.getElementById('barrioLocalidad');
    if (!barrioInput) return;
    
    // Verificar si ya hay un mensaje
    const existingMsg = barrioInput.parentNode.querySelector('.sugerencia-barrio');
    if (existingMsg) return;
    
    const sugerenciaDiv = document.createElement('div');
    sugerenciaDiv.className = 'sugerencia-barrio text-xs text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1 animate-pulse';
    sugerenciaDiv.innerHTML = `
        <span class="material-symbols-outlined text-sm">info</span>
        <span>¿No encontró el barrio? Escríbelo manualmente aquí.</span>
    `;
    
    barrioInput.parentNode.appendChild(sugerenciaDiv);
    
    // Remover después de 10 segundos
    setTimeout(() => {
        if (sugerenciaDiv.parentElement) sugerenciaDiv.remove();
    }, 10000);
}

function mostrarSugerenciaFormatoDireccion() {
    const direccionInput = document.getElementById('direccionDestino');
    if (!direccionInput) return;
    
    // Solo mostrar una vez por sesión
    if (sessionStorage.getItem('mostradoSugerenciaFormato')) return;
    
    const sugerenciaDiv = document.createElement('div');
    sugerenciaDiv.className = 'fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm';
    sugerenciaDiv.innerHTML = `
        <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-sm">tips_and_updates</span>
            <span>💡 <strong>Sugerencia:</strong> Usa formato "Calle 80 # 12-34, Barrio" para mejores resultados</span>
        </div>
    `;
    
    document.body.appendChild(sugerenciaDiv);
    sessionStorage.setItem('mostradoSugerenciaFormato', 'true');
    
    setTimeout(() => {
        sugerenciaDiv.style.animation = 'slideDown 0.3s ease-in forwards';
        setTimeout(() => {
            if (sugerenciaDiv.parentElement) sugerenciaDiv.remove();
        }, 300);
    }, 5000);
}

function mostrarNotificacionSimple(mensaje) {
    // Eliminar notificaciones anteriores
    const notifsAnteriores = document.querySelectorAll('.notificacion-simple');
    notifsAnteriores.forEach(n => n.remove());
    
    const notificacion = document.createElement('div');
    notificacion.className = 'notificacion-simple fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-slideUp';
    notificacion.style.cssText = `
        animation: slideUp 0.3s ease-out forwards;
        white-space: nowrap;
        max-width: 90%;
        overflow: hidden;
        text-overflow: ellipsis;
    `;
    
    notificacion.innerHTML = `
        <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-sm">check_circle</span>
            <span class="text-sm font-medium">${mensaje}</span>
        </div>
    `;
    
    document.body.appendChild(notificacion);
    
    setTimeout(() => {
        notificacion.style.animation = 'slideDown 0.3s ease-in forwards';
        setTimeout(() => {
            if (notificacion.parentElement) notificacion.remove();
        }, 300);
    }, 3000);
}

function mostrarErrorGoogleMaps() {
    const direccionInput = document.getElementById('direccionDestino');
    if (direccionInput) {
        const existingError = direccionInput.parentNode.querySelector('.google-maps-error');
        if (!existingError) {
            const errorMsg = document.createElement('div');
            errorMsg.className = 'google-maps-error text-xs text-orange-600 dark:text-orange-400 mt-1 flex items-center gap-1';
            errorMsg.innerHTML = `
                <span class="material-symbols-outlined text-sm">warning</span>
                <span>Google Maps no disponible. Escribe la dirección manualmente.</span>
            `;
            
            direccionInput.parentNode.appendChild(errorMsg);
            
            setTimeout(() => {
                if (errorMsg.parentElement) errorMsg.remove();
            }, 10000);
        }
    }
}

// ============================================
// INICIALIZACIÓN PRINCIPAL MEJORADA
// ============================================

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
        
        /* Mejores estilos para Google Places */
        .pac-container {
            z-index: 10002 !important;
            border-radius: 8px !important;
            box-shadow: 0 10px 25px rgba(0,0,0,0.2) !important;
            border: 1px solid #d1d5db !important;
            margin-top: 4px !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        }
        
        .pac-item {
            padding: 12px 16px !important;
            cursor: pointer !important;
            border-bottom: 1px solid #f3f4f6 !important;
            font-size: 14px !important;
            transition: background-color 0.2s !important;
        }
        
        .pac-item:hover {
            background-color: #eff6ff !important;
        }
        
        .pac-item-selected {
            background-color: #dbeafe !important;
        }
        
        .pac-icon {
            margin-right: 10px !important;
            opacity: 0.7 !important;
        }
        
        .pac-matched {
            font-weight: 600 !important;
            color: #1d4ed8 !important;
        }
        
        /* Estilos para sugerencias */
        .sugerencia-barrio {
            animation-duration: 2s;
            animation-iteration-count: 3;
        }
        
        @media (max-width: 767px) {
            .pac-container {
                position: fixed !important;
                top: auto !important;
                bottom: 0 !important;
                left: 0 !important;
                right: 0 !important;
                width: 100vw !important;
                max-height: 60vh !important;
                border-radius: 16px 16px 0 0 !important;
                box-shadow: 0 -4px 20px rgba(0,0,0,0.15) !important;
            }
        }
        
        /* Mejor contraste para dark mode */
        @media (prefers-color-scheme: dark) {
            .pac-container {
                background-color: #1f2937 !important;
                border-color: #4b5563 !important;
            }
            
            .pac-item {
                color: #f3f4f6 !important;
                border-bottom-color: #374151 !important;
            }
            
            .pac-item:hover {
                background-color: #374151 !important;
            }
            
            .pac-item-selected {
                background-color: #1e40af !important;
            }
            
            .pac-matched {
                color: #60a5fa !important;
            }
        }
    `;
    document.head.appendChild(style);
}

function initApp() {
    console.log('🚀 Inicializando aplicación MEJORADA...');
    
    initializeDOMElements();
    
    loadBarriosData().then(() => {
        loadRemitentesData();
        loadUsuariosParaAutocomplete().then(() => {
            setupEventListeners();
            initializeUI();
            
            // ============================================
            // INICIALIZACIÓN MEJORADA DE GOOGLE MAPS
            // ============================================
            const checkGoogleMaps = () => {
                console.log('🔍 Verificando Google Maps MEJORADO...');
                
                if (typeof google !== 'undefined' && google.maps && google.maps.places) {
                    console.log('✅ Google Maps API disponible');
                    try {
                        // Cargar también la API de Geocoding para mejor precisión
                        if (!google.maps.Geocoder) {
                            console.log('🔄 Cargando Geocoding API...');
                        }
                        
                        inicializarGooglePlacesAutocomplete();
                        console.log('🎯 Google Places Autocomplete inicializado con mejoras');
                    } catch (error) {
                        console.error('❌ Error inicializando Google Places:', error);
                        mostrarErrorGoogleMapsFatal();
                    }
                } else {
                    console.log('⏳ Google Maps no disponible aún, esperando...');
                    
                    if (window.googleMapsRetryCount === undefined) {
                        window.googleMapsRetryCount = 0;
                    }
                    
                    if (window.googleMapsRetryCount < 15) { // 15 intentos = 7.5 segundos
                        window.googleMapsRetryCount++;
                        setTimeout(checkGoogleMaps, 500);
                    } else {
                        console.error('❌ Google Maps no se cargó después de 7.5 segundos');
                        mostrarErrorGoogleMapsFatal();
                        
                        // Aún así, habilitar extracción manual de barrios
                        habilitarExtraccionManualBarrios();
                    }
                }
            };
            
            // Iniciar verificación
            checkGoogleMaps();
            
            console.log('✅ Aplicación inicializada con mejoras');
        });
    }).catch(error => {
        console.error('❌ Error inicializando:', error);
        loadRemitentesData();
        setupEventListeners();
        initializeUI();
        habilitarExtraccionManualBarrios();
    });
}

function habilitarExtraccionManualBarrios() {
    console.log('🔧 Habilitando extracción manual de barrios...');
    
    const direccionInput = document.getElementById('direccionDestino');
    const barrioInput = document.getElementById('barrioLocalidad');
    
    if (direccionInput && barrioInput) {
        // Cuando el usuario termine de escribir la dirección
        let timeoutId;
        direccionInput.addEventListener('input', function() {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                if (this.value.trim().length > 10 && !barrioInput.value) {
                    console.log('🔍 Intentando extraer barrio del texto manual...');
                    extraerBarrioDeTexto(this.value, barrioInput);
                }
            }, 1000);
        });
        
        // Cuando el campo pierda el foco
        direccionInput.addEventListener('blur', function() {
            setTimeout(() => {
                if (this.value.trim().length > 10 && !barrioInput.value) {
                    extraerBarrioDeTexto(this.value, barrioInput);
                }
            }, 300);
        });
    }
}

// ============================================
// FUNCIONES RESTANTES (MANTENIDAS IGUAL)
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
            
            // Mejorar los datos de barrios para búsquedas
            if (barriosData.length > 0) {
                barriosData.forEach(barrio => {
                    // Crear variantes de nombres para mejor búsqueda
                    if (barrio.nombre) {
                        barrio.nombreVariantes = [
                            barrio.nombre,
                            barrio.nombre.replace('BRR ', ''),
                            barrio.nombre.replace('SECTOR ', ''),
                            barrio.nombre.replace('LOCALIDAD ', '')
                        ];
                    }
                });
            }
            
            return data;
        })
        .catch(error => {
            console.error('❌ Error cargando barrios:', error);
            barriosData = getDefaultBarrios();
            window.barriosData = barriosData;
            return barriosData;
        });
}

function getDefaultBarrios() {
    return [
        { id: "ATB6ZXHU", nombre: "USAQUÉN-SANTA BARBARA ORIENTAL" },
        { id: "1HOGOY32", nombre: "USAQUÉN-SANTA BARBARA CENTRAL" },
        { id: "WYWRDLUX", nombre: "USAQUÉN-CHICO NORTE II SECTOR" },
        { id: "5TKZNTB2", nombre: "USAQUÉN-SANTA BARBARA OCCIDENTAL" },
        { id: "5DUKSNR5", nombre: "USAQUÉN-SAN PATRICIO" },
        { id: "EXAMPLE1", nombre: "CHAPINERO" },
        { id: "EXAMPLE2", nombre: "SUBA" },
        { id: "EXAMPLE3", nombre: "KENNEDY" },
        { id: "EXAMPLE4", nombre: "BOSA" },
        { id: "EXAMPLE5", nombre: "FONTIBÓN" },
        { id: "EXAMPLE6", nombre: "ENGATIVÁ" },
        { id: "EXAMPLE7", nombre: "TEUSAQUILLO" },
        { id: "EXAMPLE8", nombre: "BARRIOS UNIDOS" }
    ];
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
        
        usuariosDisponibles = usuarios.filter(u => 
            u.ESTADO === "ACTIVO" && 
            u.ROL === "CLIENTE" &&
            (u["NOMBRE REMITENTE"] || u["NOMBRE COMPLETO"])
        );
        
        window.usuariosDisponibles = usuariosDisponibles;
        
        console.log(`📊 ${usuariosDisponibles.length} usuarios disponibles para autocomplete`);
        
        return usuariosDisponibles;
        
    } catch (error) {
        console.error("❌ Error cargando usuarios para autocomplete:", error);
        usuariosDisponibles = [];
        window.usuariosDisponibles = [];
        return [];
    }
}

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
    
    if (usuario.ESTADO !== "ACTIVO") {
        console.log("⚠️ Usuario inactivo, cerrando sesión...");
        localStorage.removeItem("usuarioLogueado");
        window.location.replace("login.html");
        return false;
    }
    
    setTimeout(() => {
        if (loadingScreen) loadingScreen.style.display = 'none';
        if (mainContent) mainContent.classList.remove('hidden');
        
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
        
        const correoRemitente = document.getElementById('correoRemitente');
        const usuarioIdField = document.getElementById('usuarioId');
        
        if (usuario) {
            if (correoRemitente) {
                correoRemitente.value = usuario["CORREO ELECTRONICO"] || usuario["CORREO"] || "";
            }
            
            if (usuarioIdField) {
                usuarioIdField.value = usuario["USUARIO"] || usuario["ID"] || "";
            }
        }
        
        configurarCamposSegunRol(usuario);
        configurarTemporizadorInactividad();
        
    }, 1000);
    
    return true;
}

function configurarCamposSegunRol(usuario) {
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
        
        const dropdown = document.getElementById('remitenteAutocomplete');
        if (dropdown) {
            dropdown.style.display = 'none';
        }
    } else {
        const remitente = document.getElementById('remitente');
        const iconRemitente = document.getElementById('iconRemitente');
        
        if (remitente) {
            remitente.removeAttribute('readonly');
            remitente.classList.remove('cliente-readonly');
            remitente.placeholder = "Ej. Distribuidora Central S.A.";
            if (iconRemitente) iconRemitente.textContent = 'search';
            
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
    let tiempoInactividad = 30 * 60 * 1000;
    
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
    
    ['click', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(evento => {
        document.addEventListener(evento, reiniciarTemporizador);
    });
    
    reiniciarTemporizador();
}

function inicializarAutocompleteRemitente() {
    console.log("🔧 ===== INICIALIZANDO AUTOCOMPLETE REMITENTES =====");
    
    const inputRemitente = document.getElementById('remitente');
    let dropdown = document.getElementById('remitenteAutocomplete');
    
    if (!inputRemitente) {
        console.error("❌ No se encontró el campo remitente");
        return;
    }
    
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
    
    let ignoreBlur = false;
    let mouseInDropdown = false;
    
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
    
    function mostrarSugerencias(usuarios) {
        dropdown.innerHTML = '';
        
        if (usuarios.length === 0) {
            dropdown.style.display = 'none';
            return;
        }
        
        console.log(`📋 Mostrando ${usuarios.length} sugerencias`);
        
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
            
            item.addEventListener('mousedown', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log("🖱️ CLIC detectado en item (mousedown)");
                
                ignoreBlur = true;
                
                setTimeout(() => {
                    console.log("🎯 Procesando selección...");
                    
                    const telefonoValor = usuario["TELEFONO REMITENTE"] || usuario.TELEFONO;
                    const telefonoStr = telefonoValor ? telefonoValor.toString() : "";
                    
                    document.getElementById('remitente').value = usuario["NOMBRE REMITENTE"] || usuario["NOMBRE COMPLETO"] || "";
                    document.getElementById('telefonoRemitente').value = telefonoStr;
                    document.getElementById('direccionRemitente').value = usuario["DIRECCION REMITENTE"] || "";
                    
                    ['remitente', 'telefonoRemitente', 'direccionRemitente'].forEach(id => {
                        const campo = document.getElementById(id);
                        if (campo) {
                            campo.dispatchEvent(new Event('input', { bubbles: true }));
                            campo.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    });
                    
                    console.log("✅ VALORES ASIGNADOS:");
                    console.log("   Remitente:", document.getElementById('remitente').value);
                    console.log("   Teléfono:", document.getElementById('telefonoRemitente').value);
                    console.log("   Dirección:", document.getElementById('direccionRemitente').value);
                    
                    dropdown.style.display = 'none';
                    dropdown.innerHTML = '';
                    
                    setTimeout(() => {
                        const siguienteCampo = document.getElementById('destinatario');
                        if (siguienteCampo) {
                            siguienteCampo.focus();
                        }
                    }, 100);
                    
                    setTimeout(() => {
                        ignoreBlur = false;
                    }, 300);
                }, 10);
            });
            
            item.addEventListener('click', function(e) {
                console.log("🖱️ CLIC detectado en item (click)");
            });
            
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
        
        const inputRect = inputRemitente.getBoundingClientRect();
        dropdown.style.position = 'fixed';
        dropdown.style.top = `${inputRect.bottom + window.scrollY}px`;
        dropdown.style.left = `${inputRect.left + window.scrollX}px`;
        dropdown.style.width = `${inputRect.width}px`;
        dropdown.style.display = 'block';
        
        dropdown.addEventListener('mouseenter', () => {
            mouseInDropdown = true;
        });
        
        dropdown.addEventListener('mouseleave', () => {
            mouseInDropdown = false;
        });
    }
    
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
            mostrarSugerencias(usuariosDisponibles.slice(0, 3));
        }
    });
    
    inputRemitente.addEventListener('blur', function(e) {
        setTimeout(() => {
            if (!ignoreBlur && !mouseInDropdown) {
                dropdown.style.display = 'none';
                console.log("👆 Blur normal - ocultando dropdown");
            } else {
                console.log("⏸️ Blur ignorado - usuario interactuando con dropdown");
            }
        }, 200);
    });
    
    dropdown.addEventListener('mousedown', function(e) {
        console.log("🖱️ Mouse down en dropdown - previniendo blur");
        ignoreBlur = true;
        e.stopPropagation();
    });
    
    document.addEventListener('mousedown', function(e) {
        const clickEnInput = inputRemitente.contains(e.target);
        const clickEnDropdown = dropdown.contains(e.target);
        
        if (!clickEnInput && !clickEnDropdown) {
            setTimeout(() => {
                if (!mouseInDropdown) {
                    dropdown.style.display = 'none';
                    console.log("👆 Click fuera - ocultando dropdown");
                }
            }, 100);
        }
    });
    
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

function inicializarFormulario() {
    console.log("📝 Inicializando formulario...");
    
    const paymentOptions = document.querySelectorAll('.payment-option');
    const formaPagoInput = document.getElementById('formaPago');
    
    paymentOptions.forEach(option => {
        option.addEventListener('click', function() {
            paymentOptions.forEach(opt => opt.classList.remove('selected'));
            this.classList.add('selected');
            
            const selectedValue = this.getAttribute('data-value');
            formaPagoInput.value = selectedValue;
            
            actualizarResumen();
            manejarValorRecaudar(selectedValue);
        });
    });

    if (paymentOptions[0]) {
        paymentOptions[0].click();
    }
    
    document.getElementById('cancelButton').addEventListener('click', function() {
        if (confirm('¿Estás seguro de que deseas cancelar este envío? Se perderán todos los datos ingresados.')) {
            resetearFormulario();
        }
    });
    
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', function() {
            if (confirm("¿Estás seguro de que deseas cerrar sesión?")) {
                localStorage.removeItem("usuarioLogueado");
                window.location.href = "login.html";
            }
        });
    }
    
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
    
    document.getElementById('deliveryForm').addEventListener('submit', manejarEnvioFormulario);
    
    console.log("✅ Formulario inicializado correctamente");
}

function manejarValorRecaudar(formaPago) {
    const valorRecaudarInput = document.getElementById('valorRecaudar');
    const valorRecaudarHelp = document.getElementById('valorRecaudarHelp');
    const autoRecaudoLabel = document.getElementById('autoRecaudoLabel');
    const ciudadDestino = document.getElementById('ciudadDestino').value;
    
    if (formaPago === 'contraentrega' || formaPago === 'contraentrega_recaudo') {
        valorRecaudarInput.disabled = false;
        valorRecaudarInput.placeholder = "Ej. 50,000";
        valorRecaudarHelp.textContent = "Ingrese el valor a recaudar al destinatario";
        
        if (formaPago === 'contraentrega') {
            let valorAuto = 0;
            if (ciudadDestino.includes("Bogotá")) {
                valorAuto = 10000;
            } else if (ciudadDestino.includes("Soacha")) {
                valorAuto = 12000;
            }
            
            valorRecaudarInput.value = valorAuto;
            valorRecaudarInput.disabled = true;
            autoRecaudoLabel.classList.remove('hidden');
            autoRecaudoLabel.textContent = 'AUTO';
            valorRecaudarHelp.textContent = `Valor automático para ${ciudadDestino}`;
            
            valorRecaudarInput.classList.remove('bg-input-light', 'dark:bg-input-dark');
            valorRecaudarInput.classList.add('bg-gray-100', 'dark:bg-gray-800', 'text-gray-700', 'dark:text-gray-300');
        } else {
            valorRecaudarInput.value = "";
            autoRecaudoLabel.classList.add('hidden');
            valorRecaudarHelp.textContent = "Ingrese el valor a recaudar al destinatario";
            
            valorRecaudarInput.classList.remove('bg-gray-100', 'dark:bg-gray-800');
            valorRecaudarInput.classList.add('bg-input-light', 'dark:bg-input-dark', 'text-[#0d121b]', 'dark:text-white');
        }
        
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
        valorRecaudarInput.disabled = true;
        valorRecaudarInput.value = "";
        valorRecaudarHelp.textContent = "No aplica para pagos de contado";
        autoRecaudoLabel.classList.add('hidden');
        
        valorRecaudarInput.classList.remove('bg-input-light', 'dark:bg-input-dark', 'text-[#0d121b]', 'dark:text-white');
        valorRecaudarInput.classList.add('bg-gray-100', 'dark:bg-gray-800', 'text-gray-500', 'dark:text-gray-400');
        
        valorRecaudarInput.classList.remove('invalid');
    }
    
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
    
    const valorRecaudarInput = document.getElementById('valorRecaudar');
    const formaPago = document.getElementById('formaPago').value;
    
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
        if (ciudadDestino.includes("Bogotá")) {
            totalAPagar = Math.max(0, valorRecaudar - 10000);
        } else if (ciudadDestino.includes("Soacha")) {
            totalAPagar = Math.max(0, valorRecaudar - 12000);
        }
    }
    
    return totalAPagar;
}

function setupEventListeners() {
    console.log('🔗 Configurando event listeners...');
    
    const ciudadDestinoSelect = document.getElementById('ciudadDestino');
    if (ciudadDestinoSelect) {
        ciudadDestinoSelect.addEventListener('change', function() {
            const ciudad = this.value;
            const formaPago = document.getElementById('formaPago').value;
            
            if (formaPago === 'contraentrega') {
                let valorAuto = 0;
                if (ciudad.includes("Bogotá")) {
                    valorAuto = 10000;
                } else if (ciudad.includes("Soacha")) {
                    valorAuto = 12000;
                }
                
                document.getElementById('valorRecaudar').value = valorAuto;
            }
            
            const valorRecaudar = calcularValorARecaudar();
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
        
        barrioInput.addEventListener('blur', function() {
            console.log('⚠️ Blur detectado - escribiendo:', escribiendo, '- ignoreBlur:', ignoreBlur);
            
            if (escribiendo || ignoreBlur || dropdownJustClicked) {
                console.log('🚫 Ignorando blur - recuperando foco');
                
                setTimeout(() => {
                    if (barrioInput) {
                        barrioInput.focus();
                        const len = barrioInput.value.length;
                        barrioInput.setSelectionRange(len, len);
                    }
                }, 10);
                
                return;
            }
            
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
    
    const formasPagoTexto = {
        'contado': 'Contado',
        'contraentrega': 'Contraentrega',
        'contraentrega_recaudo': 'Con Recaudo'
    };
    document.getElementById('resumenFormaPago').textContent = formasPagoTexto[formaPago];
    
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
    
    const totalAPagar = calcularTotalAPagar();
    let totalTexto = 'No aplica';
    let estadoTexto = 'Por confirmar';
    let estadoColor = 'text-yellow-600 dark:text-yellow-400';
    
    if (ciudadDestino) {
        let tarifaCiudad = 0;
        if (ciudadDestino.includes("Bogotá")) {
            tarifaCiudad = 10000;
        } else if (ciudadDestino.includes("Soacha")) {
            tarifaCiudad = 12000;
        }
        
        if (formaPago === 'contado') {
            estadoTexto = 'Pendiente de pago';
            estadoColor = 'text-yellow-600 dark:text-yellow-400';
            totalTexto = '$0';
        } else if (formaPago === 'contraentrega') {
            estadoTexto = 'A recaudar';
            estadoColor = 'text-blue-600 dark:text-blue-400';
            totalTexto = '$0';
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

async function manejarEnvioFormulario(e) {
    e.preventDefault();
    
    if (formularioEnviandose) {
        console.log('⚠️ Formulario ya enviándose, ignorando clic...');
        return;
    }
    
    console.log('📤 Iniciando envío de formulario...');
    
    if (!validarFormulario()) {
        alert('Por favor complete todos los campos requeridos correctamente');
        return;
    }
    
    const submitButton = document.getElementById('submitButton');
    const submitText = document.getElementById('submitText');
    const submitIcon = document.getElementById('submitIcon');
    
    submitButton.disabled = true;
    formularioEnviandose = true;
    submitButton.classList.add('opacity-70', 'cursor-not-allowed');
    submitText.textContent = 'Procesando...';
    submitIcon.textContent = 'hourglass_top';
    
    try {
        const formaPago = document.getElementById('formaPago').value;
        const ciudadDestino = document.getElementById('ciudadDestino').value;
        
        let valorRecaudar;
        
        if (formaPago === 'contraentrega') {
            if (ciudadDestino.includes("Bogotá")) {
                valorRecaudar = 10000;
            } else if (ciudadDestino.includes("Soacha")) {
                valorRecaudar = 12000;
            }
            document.getElementById('valorRecaudar').value = valorRecaudar;
        } else if (formaPago === 'contraentrega_recaudo') {
            valorRecaudar = parseFloat(document.getElementById('valorRecaudar').value) || 0;
        } else {
            valorRecaudar = 0;
        }
        
        const totalAPagar = calcularTotalAPagar();
        const usuarioActual = JSON.parse(localStorage.getItem("usuarioLogueado"));
        
        const idLocal = generarIDLocal();
        console.log("🆔 ID ÚNICO generado para TODO:", idLocal);
        
        const direccionDestino = document.getElementById('direccionDestino').value;

        let latitud = "";
        let longitud = "";

        if (window.ultimaDireccionSeleccionada) {
            latitud = window.ultimaDireccionSeleccionada.latitud.toString();
            longitud = window.ultimaDireccionSeleccionada.longitud.toString();
            
            console.log("📍 Coordenadas obtenidas:", latitud, longitud);
        } else {
            console.warn("⚠️ No hay coordenadas disponibles");
        }

        const direccionCodificada = encodeURIComponent(direccionDestino.trim());
        const urlGoogleMaps = `https://www.google.com/maps/search/?api=1&query=${direccionCodificada}`;

        console.log('📍 URL Google Maps generada:', urlGoogleMaps);
        console.log('📍 Coordenadas para hoja:', `${latitud}, ${longitud}`);
        
        const datosEnvio = {
            "ENVIO ID": idLocal,
            "FORMA DE PAGO": formaPago,
            "REMITE": document.getElementById('remitente').value,
            "TELEFONO": document.getElementById('telefonoRemitente').value,
            "DIRECCION": document.getElementById('direccionRemitente').value,
            "CIUDAD": document.getElementById('ciudadOrigen').value,
            "DESTINO": document.getElementById('destinatario').value,
            "DIRECCION DESTINO": direccionDestino,
            "BARRIO": document.getElementById('barrioLocalidad').value,
            "TELEFONOCLIENTE": document.getElementById('telefonoCliente').value,
            "COMPLEMENTO DE DIR": document.getElementById('complementoDireccion').value || "",
            "CIUDAD DESTINO": ciudadDestino,
            "VALOR A RECAUDAR": valorRecaudar.toString(),
            "TOTAL A PAGAR": totalAPagar.toString(),
            "PAGADO A REMITENTE": "false",
            "FECHA PAGO": "",
            "FIRMA": "",
            "OBS": "",
            "LOCALIDAD": "",
            "MENSAJERO": "",
            "CORREO REMITENTE": document.getElementById('correoRemitente').value || "",
            "USUARIO ID": usuarioActual ? usuarioActual.USUARIO : "",
            "URL DIRECCION MAPS": urlGoogleMaps,
            "COORDENADAS": `${latitud}, ${longitud}`,
        };
        
        console.log('📝 Datos a enviar a Google Sheets (con URL de Maps):', datosEnvio);
        
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
        
        const confirmMessage = `¿Confirmar registro de envío?\n\n📍 Destino: ${datosEnvio["CIUDAD DESTINO"]}\n👤 Cliente: ${datosEnvio["DESTINO"]}\n💰 Valor a recaudar: $${parseInt(datosEnvio["VALOR A RECAUDAR"]).toLocaleString()}`;
        
        if (!confirm(confirmMessage)) {
            submitButton.disabled = false;
            formularioEnviandose = false;
            submitButton.classList.remove('opacity-70', 'cursor-not-allowed');
            submitText.textContent = 'Registrar Envío';
            submitIcon.textContent = 'send';
            return;
        }
        
        console.log('📡 Enviando datos a Google Apps Script...');
        
        try {
            const formData = new FormData();
            
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
            formData.append("urlMaps", datosEnvio["URL DIRECCION MAPS"]);
            formData.append("coordenadas", datosEnvio["COORDENADAS"]);
            
            console.log('📤 Enviando FormData (con ID único):');
            for (let pair of formData.entries()) {
                console.log(`  ${pair[0]}: ${pair[1]}`);
            }
            
            const response = await fetch(WEB_APP_URL, {
                method: 'POST',
                mode: 'no-cors',
                body: formData
            });
            
            console.log('📨 Respuesta recibida:', response);
            
            const datosCompletosParaGuia = {
                ...datosEnvio,
                "ENVIO ID": idLocal,
                envioId: idLocal,
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
                totalAPagar: datosEnvio["TOTAL A PAGAR"],
                urlMaps: datosEnvio["URL DIRECCION MAPS"]
            };

            localStorage.setItem('ultimoEnvioCompleto', JSON.stringify(datosCompletosParaGuia));
            
            guardarEnvioEnLocalStorage(datosEnvio);
            
            setTimeout(() => {
                mostrarResultadoExitoso(datosEnvio, idLocal);
            }, 500);
            
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
            
            setTimeout(() => {
                successMessage.remove();
            }, 5000);
            
            setTimeout(() => {
                resetearFormulario();
                formularioEnviandose = false;
            }, 3000);
            
        } catch (fetchError) {
            console.error('❌ Error en el envío:', fetchError);
            
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
            
            setTimeout(() => {
                errorMessage.remove();
            }, 5000);
            
            submitButton.disabled = false;
            formularioEnviandose = false;
            submitButton.classList.remove('opacity-70', 'cursor-not-allowed');
            submitText.textContent = 'Registrar Envío';
            submitIcon.textContent = 'send';
            
            setTimeout(() => {
                resetearFormulario();
            }, 3000);
        }
        
    } catch (error) {
        console.error('❌ Error crítico en el envío:', error);
        
        alert(`Error: ${error.message}\n\nPor favor intenta nuevamente.`);
        
        submitButton.disabled = false;
        formularioEnviandose = false;
        submitButton.classList.remove('opacity-70', 'cursor-not-allowed');
        submitText.textContent = 'Registrar Envío';
        submitIcon.textContent = 'send';
    }
}

function guardarEnvioEnLocalStorage(datosEnvio) {
    try {
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

function validarFormulario() {
    let valido = true;
    
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
    
    camposRequeridos.forEach(id => {
        const campo = document.getElementById(id);
        if (campo && !campo.value.trim()) {
            campo.classList.add('invalid');
            valido = false;
        } else if (campo) {
            campo.classList.remove('invalid');
        }
    });
    
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
    const deliveryForm = document.getElementById('deliveryForm');
    if (deliveryForm) deliveryForm.reset();
    
    if (barrioIdInput) barrioIdInput.value = '';
    
    const paymentOptions = document.querySelectorAll('.payment-option');
    paymentOptions.forEach(opt => opt.classList.remove('selected'));
    if (paymentOptions[0]) {
        paymentOptions[0].click();
    }
    
    document.querySelectorAll('.invalid').forEach(el => {
        el.classList.remove('invalid');
    });
    
    formularioEnviandose = false;
    
    const usuario = JSON.parse(localStorage.getItem("usuarioLogueado"));
    if (usuario && usuario.ROL === "CLIENTE") {
        const remitente = document.getElementById('remitente');
        const direccionRemitente = document.getElementById('direccionRemitente');
        const telefonoRemitente = document.getElementById('telefonoRemitente');
        
        if (remitente) remitente.value = usuario["NOMBRE REMITENTE"] || usuario["NOMBRE COMPLETO"] || "";
        if (direccionRemitente) direccionRemitente.value = usuario["DIRECCION REMITENTE"] || "";
        if (telefonoRemitente) telefonoRemitente.value = usuario["TELEFONO REMITENTE"] || usuario["TELEFONO"] || "";
    }
    
    const submitButton = document.getElementById('submitButton');
    const submitText = document.getElementById('submitText');
    const submitIcon = document.getElementById('submitIcon');
    
    if (submitButton) {
        submitButton.disabled = false;
        submitButton.classList.remove('opacity-70', 'cursor-not-allowed');
    }
    if (submitText) submitText.textContent = 'Registrar Envío';
    if (submitIcon) submitIcon.textContent = 'send';
    
    actualizarResumen();
    
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

function mostrarResultadoExitoso(datosEnvio, idGenerado) {
    console.log('🎉 Mostrando resultado exitoso con ID:', idGenerado);
    
    const deliveryForm = document.getElementById('deliveryForm');
    if (deliveryForm) {
        deliveryForm.style.display = 'none';
    }
    
    const resultSection = document.getElementById('resultSection');
    if (resultSection) {
        resultSection.classList.remove('hidden');
        
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
        
        setTimeout(() => {
            abrirGuiaAutomatically(idGenerado, datosEnvio);
        }, 2000);
        
        const printGuideBtn = document.getElementById('printGuideBtn');
        if (printGuideBtn) {
            printGuideBtn.replaceWith(printGuideBtn.cloneNode(true));
            const newPrintGuideBtn = document.getElementById('printGuideBtn');
            newPrintGuideBtn.addEventListener('click', function() {
                abrirGuiaAutomatically(idGenerado, datosEnvio);
            });
        }
        
        const newDeliveryBtn = document.getElementById('newDeliveryBtn');
        if (newDeliveryBtn) {
            newDeliveryBtn.replaceWith(newDeliveryBtn.cloneNode(true));
            
            const newNewDeliveryBtn = document.getElementById('newDeliveryBtn');
            newNewDeliveryBtn.addEventListener('click', function() {
                resultSection.classList.add('hidden');
                if (deliveryForm) {
                    deliveryForm.style.display = 'block';
                    resetearFormulario();
                }
            });
        }
        
        localStorage.setItem('envioParaGuia', idGenerado);
    }
}

function abrirGuiaAutomatically(idGenerado, datosEnvio) {
    console.log('📄 Abriendo guía automáticamente:', idGenerado);
    
    localStorage.setItem('envioParaGuia', idGenerado);
    
    localStorage.setItem('guiaDatosCompletos', JSON.stringify({
        datos: datosEnvio,
        timestamp: new Date().getTime()
    }));
    
    localStorage.removeItem('ultimoEnvioId');
    
    const nuevaVentana = window.open('guia.html', '_blank');
    
    if (!nuevaVentana) {
        alert('Por favor, haz clic en "Imprimir Guía" para ver la guía de envío.');
    }
}

function generarIDLocal() {
    const ahora = new Date();
    const año = ahora.getFullYear().toString().slice(-2);
    const mes = (ahora.getMonth() + 1).toString().padStart(2, '0');
    const dia = ahora.getDate().toString().padStart(2, '0');
    const hora = ahora.getHours().toString().padStart(2, '0');
    const minutos = ahora.getMinutes().toString().padStart(2, '0');
    const segundos = ahora.getSeconds().toString().padStart(2, '0');
    
    const milisegundos = ahora.getMilliseconds().toString().padStart(4, '0').slice(0, 4);
    
    return `ENV${año}${mes}${dia}${hora}${minutos}${segundos}${milisegundos}`;
}

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
        
        if (nombreUsuario) {
            nombreUsuario.textContent = usuarioLogueado.USUARIO || 'Usuario';
        }
        
        if (rolUsuario) {
            const rol = usuarioLogueado.ROL || 'Usuario';
            rolUsuario.textContent = rol;
            
            if (rol === 'ADMIN') {
                rolUsuario.classList.add('font-bold', 'text-purple-600', 'dark:text-purple-400');
            }
        }
        
        if (usuarioLogueado.ROL === 'ADMIN' && adminButton) {
            adminButton.classList.remove('hidden');
            console.log('✅ Mostrando botón de Planillas Mensajeros para ADMIN:', usuarioLogueado.USUARIO);
            
            adminButton.addEventListener('click', function(e) {
                e.preventDefault();
                console.log('🔗 Redirigiendo a planilla-mensajeros.html');
                window.location.href = 'planilla-mensajeros.html';
            });
        } else if (adminButton) {
            adminButton.style.display = 'none';
        }
        
    } catch (error) {
        console.error('❌ Error configurando botones admin:', error);
    }
}

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

document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM cargado - Iniciando aplicación MEJORADA');
    
    agregarAnimacionesCSS();
    
    setTimeout(() => {
        const intro = document.getElementById('intro');
        if (intro) intro.style.display = 'none';
    }, 1500);
    
    const sesionValida = verificarSesionYConfigurarUI();
    
    if (sesionValida) {
        setTimeout(() => {
            initApp();
        }, 100);
    }
    
    configurarBotonesAdmin();
    configurarBotonHistorial();
});
