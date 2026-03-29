# Specify the base Docker image. You can read more about
# the available images at https://crawlee.dev/docs/guides/docker-images
# You can also use any other image from Docker Hub.
FROM apify/actor-node-playwright-chrome:20 AS builder

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy just package.json and pnpm lockfile
# to speed up the build using Docker layer cache.
COPY --chown=myuser package.json pnpm-lock.yaml ./

# Install all dependencies. Don't audit to speed up the installation.
RUN pnpm install --frozen-lockfile

# Next, copy the source files using the user set
# in the base image.
COPY --chown=myuser . ./

# Install all dependencies and build the project.
RUN pnpm run build

# Create final image
FROM apify/actor-node-playwright-chrome:20

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy only built JS files from builder image
COPY --from=builder --chown=myuser /home/myuser/dist ./dist

# Copy just package.json and pnpm lockfile
# to speed up the build using Docker layer cache.
COPY --chown=myuser package.json pnpm-lock.yaml ./

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod \
    && echo "Installed packages:" \
    && (pnpm list --prod || true) \
    && echo "Node.js version:" \
    && node --version \
    && echo "pnpm version:" \
    && pnpm --version

# Next, copy the remaining files and directories with the source code.
# Since we do this after pnpm install, quick build will be really fast
# for most source file changes.
COPY --chown=myuser . ./


# Run the image. If you know you won't need headful browsers,
# you can remove the XVFB start script for a micro perf gain.
CMD ./start_xvfb_and_run_cmd.sh && pnpm run start:prod --silent
