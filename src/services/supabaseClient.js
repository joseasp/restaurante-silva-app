import { createClient } from '@supabase/supabase-js'

// Credenciais do projeto Supabase
const supabaseUrl = 'https://bsxhdkaxppqxoairnuuh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzeGhka2F4cHBxeG9haXJudXVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2OTg5NDYsImV4cCI6MjA3MjI3NDk0Nn0.1EX11ZebjWPoUNPqZgJfSsvGCPAbKWDbvWVDOvVmyAE';

// Validação para garantir que as chaves parecem corretas
if (!supabaseUrl.startsWith('http') || supabaseKey.length < 100) {
  console.error("ERRO: As credenciais do Supabase no arquivo 'supabaseClient.js' parecem inválidas. A sincronização não funcionará.");
}

export const supabase = createClient(supabaseUrl, supabaseKey);
