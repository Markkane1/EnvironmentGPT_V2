#!/bin/bash
# =====================================================
# EPA Punjab EnvironmentGPT - Deployment Script
# Phase 9: Deployment & Infrastructure
# =====================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="EnvironmentGPT"
DEPLOY_DIR="/opt/environmentgpt"
BACKUP_DIR="/opt/environmentgpt/backups"
LOG_FILE="/var/log/environmentgpt/deploy.log"
POSTGRES_SERVICE="postgres"
POSTGRES_DB="${POSTGRES_DB:-environmentgpt}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"

# Functions
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    echo "[ERROR] $(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG_FILE"
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Parse arguments
ENVIRONMENT="production"
VERSION="latest"
ACTION="deploy"

while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -v|--version)
            VERSION="$2"
            shift 2
            ;;
        -a|--action)
            ACTION="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  -e, --environment  Environment (staging|production) [default: production]"
            echo "  -v, --version      Version tag [default: latest]"
            echo "  -a, --action       Action (deploy|rollback|backup|status) [default: deploy]"
            echo "  -h, --help         Show this help message"
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            ;;
    esac
done

# Create necessary directories
mkdir -p "$BACKUP_DIR"
mkdir -p "$(dirname "$LOG_FILE")"

log "Starting $ACTION for $APP_NAME ($ENVIRONMENT) version $VERSION"

# ==================== Health Check ====================
health_check() {
    local url="http://localhost:3000/api/health"
    local max_retries=30
    local retry=0
    
    log "Running health check..."
    
    while [[ $retry -lt $max_retries ]]; do
        if curl -sf "$url" > /dev/null 2>&1; then
            success "Health check passed!"
            return 0
        fi
        retry=$((retry + 1))
        log "Health check attempt $retry/$max_retries failed, retrying..."
        sleep 5
    done
    
    error "Health check failed after $max_retries attempts"
}

# ==================== Backup ====================
create_backup() {
    log "Creating backup..."
    
    local timestamp=$(date '+%Y%m%d_%H%M%S')
    local backup_file="$BACKUP_DIR/backup_$timestamp.sql.gz"
    
    if docker-compose ps "$POSTGRES_SERVICE" >/dev/null 2>&1; then
        docker-compose exec -T "$POSTGRES_SERVICE" pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$backup_file"
        success "Backup created: $backup_file"
        
        # Clean old backups (keep last 7)
        find "$BACKUP_DIR" -name "backup_*.sql.gz" -type f -mtime +7 -delete
        log "Old backups cleaned"
    else
        warning "PostgreSQL service is not available for backup"
    fi
}

# ==================== Deploy ====================
deploy() {
    log "Starting deployment..."
    
    cd "$DEPLOY_DIR"
    
    # Pull latest images
    log "Pulling latest images..."
    docker-compose pull
    
    # Create backup before deployment
    create_backup
    
    # Stop old containers gracefully
    log "Stopping old containers..."
    docker-compose stop app
    
    # Start new containers
    log "Starting new containers..."
    docker-compose up -d --no-deps app
    
    # Wait for health check
    health_check
    
    # Clean up old images
    log "Cleaning up old images..."
    docker image prune -f
    
    success "Deployment completed successfully!"
}

# ==================== Rollback ====================
rollback() {
    log "Starting rollback..."
    
    # Find the most recent backup
    local latest_backup=$(ls -t "$BACKUP_DIR"/backup_*.sql.gz 2>/dev/null | head -1)
    
    if [[ -z "$latest_backup" ]]; then
        error "No backup found for rollback"
    fi
    
    log "Using backup: $latest_backup"
    
    cd "$DEPLOY_DIR"
    
    # Stop containers
    docker-compose stop app
    
    # Restore database
    gunzip -c "$latest_backup" | docker-compose exec -T "$POSTGRES_SERVICE" psql -U "$POSTGRES_USER" "$POSTGRES_DB"
    
    # Start containers
    docker-compose up -d --no-deps app
    
    # Wait for health check
    health_check
    
    success "Rollback completed successfully!"
}

# ==================== Status ====================
status() {
    log "Checking system status..."
    
    echo ""
    echo "=========================================="
    echo "  $APP_NAME System Status"
    echo "=========================================="
    echo ""
    
    # Container status
    echo "Container Status:"
    docker-compose ps
    echo ""
    
    # Health check
    echo "Health Check:"
    if curl -sf "http://localhost:3000/api/health" 2>/dev/null; then
        success "Application is healthy"
    else
        error "Application is not responding"
    fi
    echo ""
    
    # Database status
    echo "Database Status:"
    if docker-compose ps "$POSTGRES_SERVICE" >/dev/null 2>&1; then
        docker-compose exec -T "$POSTGRES_SERVICE" psql -U "$POSTGRES_USER" "$POSTGRES_DB" -c 'SELECT COUNT(*) AS documents FROM "Document" WHERE "isActive" = true;' 2>/dev/null || echo "  Unable to query database"
    else
        warning "PostgreSQL service is not running"
    fi
    echo ""
    
    # Disk usage
    echo "Disk Usage:"
    df -h "$DEPLOY_DIR"
    echo ""
    
    # Recent logs
    echo "Recent Logs (last 10 lines):"
    docker-compose logs --tail=10 app
    echo ""
}

# ==================== Main ====================
case $ACTION in
    deploy)
        deploy
        ;;
    rollback)
        rollback
        ;;
    backup)
        create_backup
        ;;
    status)
        status
        ;;
    *)
        error "Unknown action: $ACTION"
        ;;
esac

log "$ACTION completed"
