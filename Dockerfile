FROM mcr.microsoft.com/playwright:v1.50.1-noble

WORKDIR /app

# Copy dependency specifications
COPY package*.json tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript to dist
RUN npm run build

# Default environment variables
ENV NODE_ENV=production
ENV HEADLESS=true
ENV ALLOWED_DOMAINS=*
ENV PORT=3000

# Link binary globally
RUN npm link

EXPOSE 3000

CMD ["agent", "ui", "--no-open"]
