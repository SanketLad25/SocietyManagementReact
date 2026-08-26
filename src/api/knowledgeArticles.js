import { apiGet, apiPost, apiPut } from './client.js'

export function listKnowledgeArticles() {
  return apiGet('/knowledge-articles')
}

export function createKnowledgeArticle(payload) {
  return apiPost('/knowledge-articles', payload)
}

export function updateKnowledgeArticle(articleId, payload) {
  return apiPut(`/knowledge-articles/${articleId}`, payload)
}
