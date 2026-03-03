/**
 * Main Entry Point
 * 
 * Simple entry point that starts the server
 */
import './config/env.js' // Load environment variables
import { startServer } from './core/server.js'

// Start the server
startServer().catch((error) => {
    console.error('❌ Failed to start application:', error)
    process.exit(1)
})