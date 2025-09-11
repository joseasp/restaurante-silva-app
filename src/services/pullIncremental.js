// src/services/pullIncremental.js
// Incremental data synchronization service - pulls only updated records from server

import { db } from './databaseService.js'
import { supabase } from './supabaseClient.js'
import { getCurrentTimestamp } from '@/utils/day.js'

let isRunning = false
let pullInterval = null

/**
 * Get the last sync timestamp for a table
 * @param {string} tableName - Name of the table
 * @returns {string} Last sync timestamp or null if never synced
 */
async function getLastSyncTimestamp(tableName) {
  try {
    const config = await db.configuracoes.get(`last_pull_${tableName}`)
    return config?.valor || null
  } catch (error) {
    console.warn(`Could not get last sync for ${tableName}:`, error)
    return null
  }
}

/**
 * Save the last sync timestamp for a table
 * @param {string} tableName - Name of the table
 * @param {string} timestamp - Timestamp to save
 */
async function saveLastSyncTimestamp(tableName, timestamp) {
  try {
    await db.configuracoes.put({
      id: `last_pull_${tableName}`,
      valor: timestamp
    })
  } catch (error) {
    console.warn(`Could not save last sync for ${tableName}:`, error)
  }
}

/**
 * Pull incremental updates for a specific table
 * @param {string} tableName - Name of the table to sync
 * @param {object} dbTable - Dexie table reference
 * @returns {number} Number of records updated
 */
async function pullTableUpdates(tableName, dbTable) {
  const lastSync = await getLastSyncTimestamp(tableName)
  const currentTime = getCurrentTimestamp()
  
  try {
    let query = supabase.from(tableName).select('*')
    
    // If we have a last sync timestamp, only get records updated since then
    if (lastSync) {
      query = query.gte('updated_at', lastSync)
    }
    
    const { data, error } = await query
    
    if (error) {
      console.warn(`Pull sync error for ${tableName}:`, error.message)
      return 0
    }
    
    if (data && data.length > 0) {
      // Mark all received records as synchronized
      const recordsWithSync = data.map(record => ({
        ...record,
        ultima_sincronizacao: currentTime
      }))
      
      // Use bulkPut to update or insert records
      await dbTable.bulkPut(recordsWithSync)
      
      // Save the timestamp for next sync
      await saveLastSyncTimestamp(tableName, currentTime)
      
      console.log(`🔄 Pulled ${data.length} updates for ${tableName}`)
      return data.length
    }
    
    // Even if no data, update the last sync timestamp
    await saveLastSyncTimestamp(tableName, currentTime)
    return 0
    
  } catch (error) {
    console.warn(`Pull sync failed for ${tableName}:`, error)
    return 0
  }
}

/**
 * Run incremental pull for all tables
 * @returns {Promise<object>} Sync results
 */
export async function runIncrementalPull() {
  if (isRunning) {
    return { skipped: true, reason: 'Already running' }
  }
  
  isRunning = true
  
  try {
    const results = {}
    const tables = [
      { name: 'clientes', db: db.clientes },
      { name: 'produtos', db: db.produtos },
      { name: 'transacoes', db: db.transacoes },
      { name: 'itens_transacao', db: db['itens_transacao'] },
      { name: 'funcionarios', db: db.funcionarios }
    ]
    
    let totalUpdated = 0
    
    for (const { name, db: dbTable } of tables) {
      const updated = await pullTableUpdates(name, dbTable)
      results[name] = updated
      totalUpdated += updated
    }
    
    if (totalUpdated > 0) {
      console.log(`🔄 Incremental pull completed: ${totalUpdated} total updates`)
    }
    
    return {
      success: true,
      totalUpdated,
      results
    }
    
  } catch (error) {
    console.error('Incremental pull failed:', error)
    return {
      success: false,
      error: error.message
    }
  } finally {
    isRunning = false
  }
}

/**
 * Start the incremental pull service
 * @param {number} intervalSeconds - Interval in seconds (default: 30)
 */
export function startIncrementalPull(intervalSeconds = 30) {
  if (pullInterval) {
    clearInterval(pullInterval)
  }
  
  console.log(`🔄 Starting incremental pull every ${intervalSeconds}s`)
  
  // Run immediately
  runIncrementalPull()
  
  // Then run at intervals
  pullInterval = setInterval(() => {
    runIncrementalPull()
  }, intervalSeconds * 1000)
}

/**
 * Stop the incremental pull service
 */
export function stopIncrementalPull() {
  if (pullInterval) {
    clearInterval(pullInterval)
    pullInterval = null
    console.log('🔄 Incremental pull stopped')
  }
}

/**
 * Reset sync timestamps for all tables (force full sync on next run)
 */
export async function resetSyncTimestamps() {
  try {
    const tables = ['clientes', 'produtos', 'transacoes', 'itens_transacao', 'funcionarios']
    
    for (const tableName of tables) {
      await db.configuracoes.delete(`last_pull_${tableName}`)
    }
    
    console.log('🔄 Sync timestamps reset - next pull will be full sync')
  } catch (error) {
    console.warn('Could not reset sync timestamps:', error)
  }
}