FROM node:20-alpine AS builder

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy app source code
COPY . .

# Generate Prisma client and build the app
RUN npx prisma generate
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy necessary files from builder
COPY package*.json ./
COPY prisma ./prisma/

# Install production dependencies only
RUN npm ci --omit=dev

# Generate Prisma client for production
RUN npx prisma generate

# Copy built application
COPY --from=builder /app/dist ./dist

# Expose the application port
EXPOSE 4000

# Start the application
CMD ["npm", "run", "start:prod"]