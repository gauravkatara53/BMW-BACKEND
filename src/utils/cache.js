// utils/cache.js
import NodeCache from 'node-cache';

// Cache instance with 7 days TTL (in seconds)
const cache = new NodeCache({ stdTTL: 1 * 24 * 60 * 60, checkperiod: 600 });

const setCache = (key, value, ttl) => {
  return cache.set(key, value, ttl);
};

const getCache = (key) => {
  return cache.get(key);
};

const deleteCache = (key) => {
  return cache.del(key);
};

const flushCache = () => {
  return cache.flushAll();
};

export { setCache, getCache, deleteCache, flushCache };
