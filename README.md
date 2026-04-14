# ECHO scribe - Assistente Médico Inteligente

ECHO scribe é uma aplicação full-stack projetada para auxiliar médicos na transcrição e organização de consultas em tempo real, utilizando a API do Gemini para processamento de linguagem natural e Firebase para persistência de dados.

## 🚀 Funcionalidades

- **Transcrição em Tempo Real**: Captura áudio da consulta e transcreve instantaneamente.
- **Geração de Documentos (SOAP/LaTeX)**: Cria resumos estruturados e documentos prontos para impressão ou exportação.
- **Gestão de Pacientes**: Histórico completo de consultas e modelos de pacientes.
- **Roteiros Personalizados**: Crie checklists específicos para cada especialidade médica.
- **Dashboard Administrativo**: Visão geral de uso e métricas da plataforma.

## 🛠️ Tecnologias

- **Frontend**: React 19, Vite, Tailwind CSS, Motion.
- **Backend**: Express (para desenvolvimento local/proxy), Firebase (Auth & Firestore).
- **IA**: Google Gemini API (@google/genai).
- **Exportação**: jsPDF, Suporte nativo a LaTeX.

## 📦 Configuração para Deploy (Vercel/GitHub)

### 1. Variáveis de Ambiente

Para rodar a aplicação em produção (Vercel), configure as seguintes variáveis de ambiente:

| Variável | Descrição |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | Chave de API do Firebase |
| `VITE_FIREBASE_AUTH_DOMAIN` | Domínio de autenticação do Firebase |
| `VITE_FIREBASE_PROJECT_ID` | ID do projeto Firebase |
| `VITE_FIREBASE_STORAGE_BUCKET` | Bucket de storage do Firebase |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | ID do remetente de mensagens |
| `VITE_FIREBASE_APP_ID` | ID da aplicação Firebase |
| `VITE_FIREBASE_FIRESTORE_DATABASE_ID` | ID do banco de dados Firestore (opcional se for '(default)') |
| `GEMINI_API_KEY` | Chave de API do Google Gemini |

### 2. Deploy na Vercel

1. Conecte seu repositório GitHub à Vercel.
2. Adicione as variáveis de ambiente listadas acima.
3. O comando de build deve ser `npm run build`.
4. O diretório de saída deve ser `dist`.

## 🧪 Contas de Teste

Para testar a aplicação rapidamente, utilize as seguintes credenciais:

- **Admin**: `admin@teste.com` / `123456`
- **Usuário**: `usuario@teste.com` / `123456`

## 🔒 Segurança

- **Chaves de API**: Nunca commite arquivos `.env` ou `firebase-applet-config.json` para repositórios públicos.
- **Vercel**: Utilize o painel da Vercel para configurar as variáveis de ambiente de forma segura.
- **Firebase Rules**: Certifique-se de que suas `firestore.rules` estão configuradas corretamente para restringir o acesso apenas a usuários autenticados.

## 📄 Licença

Este projeto está sob a licença Apache-2.0.
