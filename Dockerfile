# Multi-stage Dockerfile para Sugoi Game

# Stage 1: Base PHP com Apache
FROM php:8.1-apache AS web

# Instalar dependências do sistema
RUN apt-get update && apt-get install -y \
    libzip-dev \
    zip \
    unzip \
    git \
    curl \
    libpng-dev \
    libjpeg-dev \
    libfreetype6-dev \
    libonig-dev \
    libxml2-dev \
    libssl-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Instalar extensões PHP
RUN docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) \
    pdo \
    pdo_mysql \
    mysqli \
    exif \
    pcntl \
    bcmath \
    gd \
    zip \
    sockets

# Habilitar mod_rewrite, headers e expires
RUN a2enmod rewrite headers expires

# Instalar Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Configurar diretório de trabalho
WORKDIR /var/www/html

# Copiar arquivos da aplicação
COPY public/ /var/www/html/
COPY database/ /var/www/html/database/

# Copiar arquivos do servidor de mapa
COPY servers/map/ /var/www/html/servers/map/

# Instalar dependências PHP do servidor de mapa
WORKDIR /var/www/html/servers/map
RUN composer install --no-dev --optimize-autoloader

# Voltar para diretório raiz
WORKDIR /var/www/html

# Configurar permissões
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html

# Configurar Apache
COPY docker/apache/000-default.conf /etc/apache2/sites-available/000-default.conf

# Expor porta 80 (Apache)
EXPOSE 80

# Stage 2: Node.js para chat server
FROM node:18-alpine AS chat

WORKDIR /app

# Copiar arquivos do chat server
COPY servers/chat/package*.json ./
RUN npm ci --only=production

COPY servers/chat/ ./

# Expor porta do chat
EXPOSE 3000

CMD ["npm", "start"]

# Stage 3: PHP CLI para WebSocket server
FROM php:8.1-cli AS websocket

# Instalar dependências
RUN apt-get update && apt-get install -y \
    libzip-dev \
    zip \
    unzip \
    git \
    curl \
    libssl-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Instalar extensões PHP
RUN docker-php-ext-install -j$(nproc) \
    pdo \
    pdo_mysql \
    mysqli \
    pcntl \
    bcmath \
    zip \
    sockets

# Instalar Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /app

# Copiar todos os arquivos necessários
COPY public/ /app/public/
COPY servers/map/ /app/servers/map/
COPY database/ /app/database/

# Instalar dependências
WORKDIR /app/servers/map
RUN composer install --no-dev --optimize-autoloader

# Expor porta do WebSocket
EXPOSE 9000

WORKDIR /app/servers/map

CMD ["php", "server.php"]
