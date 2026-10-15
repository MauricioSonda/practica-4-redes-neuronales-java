FROM eclipse-temurin:17-jre-jammy

WORKDIR /app
COPY neural-lab-1.0.0.jar app.jar

ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/app.jar", "web"]
