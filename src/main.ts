import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { createDocsSiteRouter } from './app/drivers/docs/docs-site.router';
import { AppModule } from './app/modules/app.module';

async function bootstrap() {
  // En produccion solo se emiten error y warn: los endpoints bulk logueaban una
  // linea por item (~60k por sync), que es el grueso del volumen y no aporta nada.
  const app = await NestFactory.create(AppModule, {
    logger:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn']
        : ['error', 'warn', 'log', 'debug', 'verbose'],
  });
  const configService = app.get(ConfigService);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Price API')
    .setDescription('Documentacion de la API de precios')
    .setVersion('1.0.0')
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
        description: 'API key requerida para consumir endpoints protegidos',
      },
      'api-key',
    )
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);

  // Swagger vivia en /docs; esa ruta ahora es del sitio de documentacion.
  SwaggerModule.setup(
    readOptionalConfig(configService, 'SWAGGER_PATH') ?? '/api/docs',
    app,
    swaggerDocument,
    {
      swaggerOptions: {
        persistAuthorization: true,
      },
    },
  );

  if (readBooleanConfig(configService, 'DOCS_SITE_ENABLED', true)) {
    const docsPath =
      readOptionalConfig(configService, 'DOCS_SITE_PATH') ?? '/docs';
    const username = readOptionalConfig(configService, 'DOCS_SITE_USER');
    const password = readOptionalConfig(configService, 'DOCS_SITE_PASSWORD');

    // Con los dos definidos pide credenciales y publica todas las paginas; sin
    // ellos queda abierto y no publica la de operacion. El markdown se lee del
    // repositorio desde el que corre el proceso.
    app.use(
      docsPath,
      createDocsSiteRouter({
        basePath: docsPath,
        rootDirectory: process.cwd(),
        credentials:
          username !== undefined && password !== undefined
            ? { username, password }
            : undefined,
      }),
    );
  }

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();

function readOptionalConfig(
  configService: ConfigService,
  name: string,
): string | undefined {
  const value = configService.get<string>(name);
  if (value === undefined || value.trim() === '') {
    return undefined;
  }
  return value.trim();
}

function readBooleanConfig(
  configService: ConfigService,
  name: string,
  defaultValue: boolean,
): boolean {
  const rawValue = readOptionalConfig(configService, name);
  if (rawValue === undefined) {
    return defaultValue;
  }
  return ['1', 'true', 'yes', 'y'].includes(rawValue.toLowerCase());
}
