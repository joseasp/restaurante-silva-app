// src/services/realtime.js
// Real-time synchronization service using Supabase realtime subscriptions

import { supabase } from './supabaseClient.js'
import { db } from './databaseService.js'
import { getCurrentTimestamp, isFromSelectedDay } from '@/utils/day.js'

let realtimeChannel = null
let currentSelectedDay = null
let eventHandlers = {}

/**
 * Handle realtime INSERT events
 * @param {object} payload - The realtime payload
 * @param {string} tableName - Name of the table
 */
async function handleRealtimeInsert(payload, tableName) {
  try {
    const record = payload.new
    const dbTable = getDbTable(tableName)
    
    if (!dbTable) return
    
    // Add sync timestamp
    const recordWithSync = {
      ...record,
      ultima_sincronizacao: getCurrentTimestamp()
    }
    
    // Insert/update in local database
    await dbTable.put(recordWithSync)
    
    // Only trigger UI update if it's for the selected day (for transacoes)
    if (shouldUpdateUI(record, tableName)) {
      console.log(`🔴 RT INSERT: ${tableName} - ${record.id}`)
      
      // Notify event handlers
      if (eventHandlers.onInsert) {
        eventHandlers.onInsert(tableName, recordWithSync)
      }
    }
    
  } catch (error) {
    console.warn(`RT INSERT error for ${tableName}:`, error)
  }
}

/**
 * Handle realtime UPDATE events
 * @param {object} payload - The realtime payload
 * @param {string} tableName - Name of the table
 */
async function handleRealtimeUpdate(payload, tableName) {
  try {
    const record = payload.new
    const dbTable = getDbTable(tableName)
    
    if (!dbTable) return
    
    // Add sync timestamp
    const recordWithSync = {
      ...record,
      ultima_sincronizacao: getCurrentTimestamp()
    }
    
    // Update in local database
    await dbTable.put(recordWithSync)
    
    // Only trigger UI update if it's for the selected day (for transacoes)
    if (shouldUpdateUI(record, tableName)) {
      console.log(`🟡 RT UPDATE: ${tableName} - ${record.id}`)
      
      // Notify event handlers
      if (eventHandlers.onUpdate) {
        eventHandlers.onUpdate(tableName, recordWithSync, payload.old)
      }
    }
    
  } catch (error) {
    console.warn(`RT UPDATE error for ${tableName}:`, error)
  }
}

/**
 * Handle realtime DELETE events
 * @param {object} payload - The realtime payload
 * @param {string} tableName - Name of the table
 */
async function handleRealtimeDelete(payload, tableName) {
  try {
    const deletedRecord = payload.old
    const dbTable = getDbTable(tableName)
    
    if (!dbTable) return
    
    // Remove from local database
    await dbTable.delete(deletedRecord.id)
    
    // Only trigger UI update if it's for the selected day (for transacoes)
    if (shouldUpdateUI(deletedRecord, tableName)) {
      console.log(`🔴 RT DELETE: ${tableName} - ${deletedRecord.id}`)
      
      // Notify event handlers
      if (eventHandlers.onDelete) {
        eventHandlers.onDelete(tableName, deletedRecord)
      }
    }
    
  } catch (error) {
    console.warn(`RT DELETE error for ${tableName}:`, error)
  }
}

/**
 * Get the Dexie table reference for a table name
 * @param {string} tableName - Name of the table
 * @returns {object|null} Dexie table reference
 */
function getDbTable(tableName) {
  const tableMap = {
    clientes: db.clientes,
    produtos: db.produtos,
    transacoes: db.transacoes,
    itens_transacao: db['itens_transacao'],
    funcionarios: db.funcionarios
  }
  
  return tableMap[tableName] || null
}

/**
 * Determine if a realtime event should trigger UI updates
 * @param {object} record - The record data
 * @param {string} tableName - Name of the table
 * @returns {boolean} True if should update UI
 */
function shouldUpdateUI(record, tableName) {
  // For transacoes, only update UI if it's from the selected day
  if (tableName === 'transacoes' && currentSelectedDay) {
    return isFromSelectedDay(record.data_transacao || record.created_at, currentSelectedDay)
  }
  
  // For other tables (clientes, produtos, funcionarios), always update
  // as they might be needed for the current day's transactions
  return ['clientes', 'produtos', 'funcionarios'].includes(tableName)
}

/**
 * Set up realtime subscriptions for all tables
 * @param {string} selectedDay - Currently selected day (YYYY-MM-DD)
 * @returns {Promise<void>}
 */
export async function setupRealtimeSync(selectedDay = null) {
  currentSelectedDay = selectedDay
  
  // Close existing subscription
  if (realtimeChannel) {
    await supabase.removeChannel(realtimeChannel)
  }
  
  // Create new subscription channel
  realtimeChannel = supabase.channel('db-changes')
  
  // Subscribe to all relevant tables
  const tables = ['clientes', 'produtos', 'transacoes', 'itens_transacao', 'funcionarios']
  
  for (const tableName of tables) {
    realtimeChannel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: tableName
      },
      (payload) => {
        switch (payload.eventType) {
          case 'INSERT':
            handleRealtimeInsert(payload, tableName)
            break
          case 'UPDATE':
            handleRealtimeUpdate(payload, tableName)
            break
          case 'DELETE':
            handleRealtimeDelete(payload, tableName)
            break
        }
      }
    )
  }
  
  // Subscribe to the channel
  realtimeChannel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('🔴 Realtime subscriptions active')
    } else if (status === 'CHANNEL_ERROR') {
      console.warn('🔴 Realtime subscription error')
    } else if (status === 'TIMED_OUT') {
      console.warn('🔴 Realtime subscription timed out')
    }
  })
}

/**
 * Update the selected day for UI filtering
 * @param {string} selectedDay - Selected day (YYYY-MM-DD)
 */
export function updateSelectedDay(selectedDay) {
  currentSelectedDay = selectedDay
  console.log(`🔴 RT filter updated for day: ${selectedDay}`)
}

/**
 * Set event handlers for realtime updates
 * @param {object} handlers - Event handler functions
 * @param {function} handlers.onInsert - Called on INSERT events
 * @param {function} handlers.onUpdate - Called on UPDATE events
 * @param {function} handlers.onDelete - Called on DELETE events
 */
export function setRealtimeEventHandlers(handlers = {}) {
  eventHandlers = handlers
}

/**
 * Stop realtime synchronization
 */
export async function stopRealtimeSync() {
  if (realtimeChannel) {
    await supabase.removeChannel(realtimeChannel)
    realtimeChannel = null
    console.log('🔴 Realtime sync stopped')
  }
}

/**
 * Check if realtime is currently connected
 * @returns {boolean} True if connected
 */
export function isRealtimeConnected() {
  return realtimeChannel?.state === 'joined'
}

/**
 * Restart realtime sync (useful for error recovery)
 */
export async function restartRealtimeSync() {
  console.log('🔴 Restarting realtime sync...')
  await stopRealtimeSync()
  
  // Wait a bit before reconnecting
  setTimeout(() => {
    setupRealtimeSync(currentSelectedDay)
  }, 1000)
}