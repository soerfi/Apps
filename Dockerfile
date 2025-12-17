# Stage 1: Build everything
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files for root (if any) and apps
# We copy everything because our build script needs to see the whole structure
COPY . .

# Install root dependencies (if any, e.g. for the script if it used external libs, but it uses standard node libs)
# However, we need to install dependencies for the build script if we add any.
# Currently build-all.js uses child_process to run npm install in subfolders.
# So we just need to run the script.

# Make the script executable
RUN chmod +x scripts/build-all.js

# Run the build script
RUN node scripts/build-all.js

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy Frontend Build
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy Nginx Config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
