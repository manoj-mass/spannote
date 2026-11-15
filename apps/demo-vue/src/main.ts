import { createApp } from 'vue';
import { SpanNotePlugin } from '@spannote/vue';
import App from './App.vue';
import { createDemoService, readConfig } from './service';
import './style.css';

const config = readConfig(window.location.search);
const service = createDemoService(config);

createApp(App).use(SpanNotePlugin, { service }).mount('#app');
