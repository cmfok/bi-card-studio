import { defineConfig } from 'vite'

// 两个入口：index.html＝编辑器（搭建），view.html＝渲染页（按版面 JSON 出图）
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        index: 'index.html', view: 'view.html', studio: 'studio.html', cards: 'cards.html',
      },
    },
  },
})
