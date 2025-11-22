// frontend/src/api/tasks.js
import { api } from '../api';

/**
 * API para gestionar tareas del restaurante
 * Por ahora usa localStorage, pero está estructurado para migrar fácilmente a backend
 */

const STORAGE_KEY = (slug) => `restaurant_tasks_${slug}`;

/**
 * Obtiene todas las tareas del restaurante
 */
export async function fetchTasks(slug) {
  try {
    // TODO: Migrar a backend cuando esté disponible
    // const response = await api.get(`/restaurants/${slug}/tasks`);
    // return response.data.data;
    
    const stored = localStorage.getItem(STORAGE_KEY(slug));
    if (stored) {
      return JSON.parse(stored);
    }
    return [];
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return [];
  }
}

/**
 * Crea una nueva tarea
 */
export async function createTask(slug, taskData) {
  try {
    // TODO: Migrar a backend cuando esté disponible
    // const response = await api.post(`/restaurants/${slug}/tasks`, { data: taskData });
    // return response.data.data;
    
    const tasks = await fetchTasks(slug);
    const newTask = {
      id: Date.now(),
      ...taskData,
      completed: false,
      createdAt: new Date().toISOString()
    };
    const updatedTasks = [...tasks, newTask];
    localStorage.setItem(STORAGE_KEY(slug), JSON.stringify(updatedTasks));
    return newTask;
  } catch (error) {
    console.error('Error creating task:', error);
    throw error;
  }
}

/**
 * Actualiza una tarea existente
 */
export async function updateTask(slug, taskId, updates) {
  try {
    // TODO: Migrar a backend cuando esté disponible
    // const response = await api.put(`/restaurants/${slug}/tasks/${taskId}`, { data: updates });
    // return response.data.data;
    
    const tasks = await fetchTasks(slug);
    const updatedTasks = tasks.map(task =>
      task.id === taskId ? { ...task, ...updates, updatedAt: new Date().toISOString() } : task
    );
    localStorage.setItem(STORAGE_KEY(slug), JSON.stringify(updatedTasks));
    return updatedTasks.find(t => t.id === taskId);
  } catch (error) {
    console.error('Error updating task:', error);
    throw error;
  }
}

/**
 * Elimina una tarea
 */
export async function deleteTask(slug, taskId) {
  try {
    // TODO: Migrar a backend cuando esté disponible
    // await api.delete(`/restaurants/${slug}/tasks/${taskId}`);
    
    const tasks = await fetchTasks(slug);
    const updatedTasks = tasks.filter(task => task.id !== taskId);
    localStorage.setItem(STORAGE_KEY(slug), JSON.stringify(updatedTasks));
    return true;
  } catch (error) {
    console.error('Error deleting task:', error);
    throw error;
  }
}