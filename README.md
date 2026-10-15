# Neural Lab Java

Aplicación universitaria reproducible con tres redes neuronales implementadas en Java puro: clasificación comercial, regresión industrial y clasificación de series de tiempo. Incluye CLI, API REST, interfaz web, resultados reales precalculados, pruebas y despliegue con Docker.

**Alumno:** Mauricio A. Sonda Cahuich  
**Materia:** Sistemas Inteligentes  
**Actividad:** Práctica 4

## Elección técnica

Se usa un MLP propio con Adam porque mantiene el proyecto auditable, liviano y portable en Java 17, sin binarios nativos; Spring Boot sirve la API y el frontend desde un único JAR ejecutable.

## Requisitos y compatibilidad

- Java 17 o posterior para compilar; el bytecode generado apunta a Java 17.
- Maven 3.6.3 o posterior. El wrapper incluido usa Maven 3.10.0.
- Spring Boot 3.5.7, cuya línea 3.5 requiere Java 17 como mínimo y Maven 3.6.3 o posterior.
- Docker opcional. Las dos etapas del `Dockerfile` usan Java 17.

La entrega fue compilada y probada con Maven 3.10.0. Aunque el equipo de desarrollo tenía un JDK posterior, `maven.compiler.release=17` garantiza compatibilidad del artefacto; el contenedor final ejecuta exactamente Java 17.

## Estructura

```text
neural-lab/
├── .mvn/wrapper/                 # Maven Wrapper
├── mvnw / mvnw.cmd
├── pom.xml
├── Dockerfile
├── render.yaml
├── .gitignore
├── README.md
├── AI_USE_TEMPLATE.md
└── src/
    ├── main/
    │   ├── java/com/example/neurallab/
    │   │   ├── NeuralLabApplication.java
    │   │   ├── core/
    │   │   │   ├── MlpNetwork.java
    │   │   │   ├── Trainer.java
    │   │   │   └── Metrics.java
    │   │   ├── data/
    │   │   │   ├── DatasetLoader.java
    │   │   │   └── DataUtils.java
    │   │   ├── tasks/
    │   │   │   ├── ClassificationExperiment.java
    │   │   │   ├── RegressionExperiment.java
    │   │   │   ├── TimeSeriesExperiment.java
    │   │   │   ├── ExperimentService.java
    │   │   │   └── TrainingRequest.java
    │   │   └── web/ExperimentController.java
    │   └── resources/
    │       ├── application.properties
    │       ├── data/             # Copias locales y fuentes/licencias
    │       └── static/           # HTML, CSS, JS y JSON precalculados
    └── test/java/com/example/neurallab/
        ├── core/MlpNetworkTest.java
        └── data/DatasetLoaderTest.java
```

## Datos y descarga automática

El programa intenta descargar el ZIP oficial, extrae la entrada necesaria y la guarda en `data-cache/`. Si la red no está disponible, lee automáticamente la copia idéntica incluida en `src/main/resources/data/`.

| Experimento | Fuente | Descarga directa | Licencia/atribución |
|---|---|---|---|
| Clasificación | [UCI Wine Quality](https://archive.ics.uci.edu/dataset/186/wine+quality) | [ZIP](https://archive.ics.uci.edu/static/public/186/wine+quality.zip) | CC BY 4.0, Cortez et al. |
| Regresión | [UCI Airfoil Self-Noise](https://archive.ics.uci.edu/dataset/291/airfoil+self+noise) | [ZIP](https://archive.ics.uci.edu/static/public/291/airfoil+self+noise.zip) | CC BY 4.0, Brooks, Pope y Marcolini/NASA |
| Serie temporal | [UCR/UEA ItalyPowerDemand](https://www.timeseriesclassification.com/description.php?Dataset=ItalyPowerDemand) | [ZIP](https://www.timeseriesclassification.com/aeon-toolkit/ItalyPowerDemand.zip) | Archivo académico UCR/UEA; conservar atribución a Dau et al. |

Los hashes y detalles completos están en `src/main/resources/data/SOURCES_AND_LICENSES.md`.

## Ejecución

### Pruebas y empaquetado

```bash
./mvnw clean test
./mvnw clean package
```

El JAR resultante es `target/neural-lab-1.0.0.jar`.

### CLI

```bash
java -jar target/neural-lab-1.0.0.jar classification
java -jar target/neural-lab-1.0.0.jar regression
java -jar target/neural-lab-1.0.0.jar timeseries
java -jar target/neural-lab-1.0.0.jar all
```

Cada comando entrena de verdad y guarda el JSON en `runtime-results/<experimento>.json`.

### Web

```bash
java -jar target/neural-lab-1.0.0.jar web
```

Abrir `http://localhost:8080`. La interfaz carga los resultados reales incluidos en el JAR; el botón **Entrenar / ejecutar** inicia una nueva corrida y la guarda en `runtime-results/`.

Endpoints:

- `GET /api/health`
- `GET /api/results/classification|regression|timeseries`
- `POST /api/train/classification|regression|timeseries`

Ejemplo de cuerpo opcional:

```json
{"epochs": 300, "learningRate": 0.001, "neurons": 32}
```

## Protocolo común

- Semilla: `20261013`.
- Normalización z-score calculada únicamente con el conjunto de entrenamiento correspondiente.
- Capas ocultas ReLU; softmax para clasificación y salida lineal para regresión.
- Adam, mini-batches y L2 `1e-4`.
- Early stopping restaura los pesos de la mejor época.
- El test no participa en selección de arquitectura ni hiperparámetros.

## Resultados reales reproducidos

Fecha de corrida: 14 de octubre de 2026. Los valores están en `src/main/resources/static/results/*.json` con curvas y datos completos.

### 1. Wine Quality: clasificación

La calidad original observada va de 3 a 9 y se agrupa así:

- **Baja:** calidad 3, 4 o 5 → 1,640 muestras.
- **Media:** calidad 6 → 2,198 muestras.
- **Alta:** calidad 7, 8 o 9 → 1,060 muestras.

Distribución: 33.48% baja, 44.88% media y 21.64% alta. La clase alta es la menor; se aplicó entropía cruzada con pesos moderados `sqrt(N/(K*n_clase))`, calculados solo con train. Split estratificado 70/15/15: 3,429/735/734.

Comparación sobre validación:

| Arquitectura | Accuracy | F1 macro | Mejor época |
|---|---:|---:|---:|
| 11→16→8→3 | 0.6027 | 0.6023 | 119 |
| **11→32→16→3** | **0.6122** | **0.6149** | 20 |
| 11→64→32→3 | 0.5810 | 0.5851 | 23 |

Resultado una sola vez en test:

| Métrica | Valor |
|---|---:|
| Accuracy | **0.5831** |
| F1 macro | **0.5771** |
| F1 ponderado | **0.5802** |

| Clase | Precisión | Recall | F1 | Soporte |
|---|---:|---:|---:|---:|
| Baja | 0.6237 | 0.7073 | 0.6629 | 246 |
| Media | 0.5587 | 0.5350 | 0.5466 | 329 |
| Alta | 0.5571 | 0.4906 | 0.5217 | 159 |

Matriz de confusión, filas reales y columnas predichas: `[[174,62,10],[101,176,52],[4,77,78]]`. La accuracy supera en 13.43 puntos porcentuales el baseline de predecir siempre la clase media (44.88%). La proximidad fisicoquímica entre clases ordinales limita el rendimiento, sobre todo entre media y alta.

### 2. Airfoil Self-Noise: regresión

Split aleatorio fijo 70/15/15: 1,052/225/226. Se compararon las arquitecturas con idénticos datos y semilla:

| Arquitectura | RMSE validación | MAE validación | R² validación | Mejor época |
|---|---:|---:|---:|---:|
| 5→32→1 | 2.6528 | 1.8187 | 0.8559 | 500 |
| 5→64→32→1 | 1.7348 | **1.1661** | 0.9384 | 428 |
| **5→128→64→1** | **1.6800** | 1.1986 | **0.9422** | 334 |

Ganó 5→128→64→1 por el criterio fijado de menor RMSE. En test obtuvo **RMSE 1.8299 dB**, **MAE 1.2480 dB** y **R² 0.9293**. L2 `1e-4` limita el crecimiento de pesos sin dominar el error; paciencia 45 admite mesetas de Adam y restaura el mejor punto antes de sobreajuste.

### 3. ItalyPowerDemand: clasificación de serie temporal

Se conserva el split oficial: 67 series de entrenamiento y 1,029 de test, cada una con 24 pasos. La selección usa validación cruzada estratificada de cinco folds exclusivamente dentro del train oficial.

| Arquitectura | Accuracy CV media | F1 macro CV media | Épocas medias |
|---|---:|---:|---:|
| **24→16→2** | **0.9857** | **0.9856** | 195 |
| 24→32→16→2 | 0.9714 | 0.9713 | 155 |
| 24→64→32→2 | 0.9857 | 0.9856 | 167 |

El empate se resolvió a favor del modelo más pequeño. Se reentrenó con las 67 series durante 195 épocas y se abrió el test oficial una sola vez: **accuracy 0.9572**, **F1 macro 0.9572** y matriz `[[487,26],[18,498]]`. No se añadió CNN 1D: el MLP ya ofrece un resultado alto y mantiene la entrega breve y auditable.

## Pruebas

La suite incluye cuatro pruebas:

1. Gradiente analítico contra diferencias finitas.
2. Forma de la salida de regresión.
3. Suma de softmax igual a 1.
4. Dimensiones oficiales de los tres respaldos y distribución exacta del vino.

Todas pasaron en la entrega. Ejecutar otra vez con `./mvnw test`.

## Docker

```bash
docker build -t neural-lab-java .
docker run --rm -p 8080:8080 neural-lab-java
```

Abrir `http://localhost:8080`.

## Publicar gratis en Render

Render admite Web Services gratuitos y despliegues desde Dockerfile. Las instancias gratuitas pueden dormirse tras 15 minutos sin tráfico y su sistema de archivos es efímero; por ello los JSON reales precalculados están dentro del JAR. Las nuevas corridas se conservan hasta el siguiente reinicio.

1. Subir este directorio a un repositorio de GitHub.
2. Crear cuenta o iniciar sesión en [Render](https://dashboard.render.com/).
3. Elegir **New → Blueprint** y conectar el repositorio; `render.yaml` configura servicio, Docker y health check.
4. Alternativamente elegir **New → Web Service**, conectar el repo y seleccionar **Docker**.
5. Elegir el plan **Free**, confirmar `/api/health` y crear el servicio.
6. Esperar `Live`. Render mostrará una URL como `https://neural-lab-java.onrender.com`.
7. Abrir esa URL y probar primero **Cargar resultado real guardado**. El primer acceso después de inactividad puede tardar cerca de un minuto.

No se puede escribir por adelantado la URL exacta: Render la asigna al crear el servicio en la cuenta del estudiante.

## GitHub y Releases

Crear y publicar el repositorio:

```bash
git init
git add .
git commit -m "Entrega completa de redes neuronales en Java"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/neural-lab-java.git
git push -u origin main
```

Crear un release con GitHub CLI:

```bash
./mvnw clean package
gh auth login
gh release create v1.0.0 target/neural-lab-1.0.0.jar \
  --title "Neural Lab Java v1.0.0" \
  --notes "Tres redes neuronales, CLI y aplicación web ejecutable."
```

Quien descargue el JAR puede ejecutar `java -jar neural-lab-1.0.0.jar web` o cualquiera de los tres modos CLI.

## Capturas recomendadas como evidencia

1. Terminal con `./mvnw test` y las cuatro pruebas aprobadas.
2. Terminal con cada uno de los tres comandos CLI y el mensaje de JSON guardado.
3. Clasificación: tarjetas de métricas, curva, matriz y tabla por clase.
4. Clasificación: distribución 1,640/2,198/1,060 y comparación de arquitecturas.
5. Regresión: tarjetas RMSE/MAE/R² y dispersión real vs. predicho.
6. Regresión: tabla de las tres arquitecturas y ganadora 5→128→64→1.
7. Serie temporal: accuracy/F1, matriz y curva de pérdida.
8. Serie temporal: tabla de 5-fold CV y tamaños oficiales 67/1,029.
9. Controles de épocas, learning rate y neuronas durante una nueva ejecución.
10. Repositorio de GitHub mostrando README, código, datasets y Release con el JAR.
11. Servicio de Render en estado `Live` y la URL pública abierta.

## Uso de IA generativa

Completar y adjuntar `AI_USE_TEMPLATE.md`; contiene declaración, espacio para prompts y lista de verificación humana.
