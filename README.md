# ☀️ SunControl - Gestão de Plantões

<p align="center">
  <img src="https://i.postimg.cc/V6HS85m6/SUN-CONTROL-removebg.png" alt="Logo SunControl" width="150">
</p>

<p align="center">
  <strong>Um sistema de gestão de trocas de plantão em tempo real, com fluxo de aprovação por múltiplos níveis e segregação de permissões por regionais.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Status-Ativo-brightgreen?style=for-the-badge" alt="Status do Projeto">
  <img src="https://img.shields.io/badge/Licen%C3%A7a-MIT-blue?style=for-the-badge" alt="Licença">
  <img src="https://img.shields.io/badge/Feito%20com-Firebase-orange?style=for-the-badge" alt="Feito com Firebase">
</p>

<br>

<p align="center">
  <em>https://i.postimg.cc/R0qm5H2V/dash.jpg</em>
</p>

## Tabela de Conteúdos

- [Funcionalidades Principais](#-funcionalidades-principais)
- [Estrutura de Papéis (Roles)](#-estrutura-de-papéis-roles)
- [Tecnologias Utilizadas](#️-tecnologias-utilizadas)
- [Créditos](#️-créditos)

## ✨ Funcionalidades Principais

O SunControl é uma plataforma de gestão completa que oferece:

* **Autenticação Segura:** Sistema completo de Login, Cadastro e **Redefinição de Senha** via e-mail.
* **Hierarquia de Permissões:** Três níveis de acesso (`Dono`, `Supervisor`, `Vigilante`) com permissões distintas.
* **Gestão por Regionais:** O sistema é segmentado por regionais. Supervisores só podem visualizar e gerenciar solicitações de suas próprias regionais, garantindo a organização e a segurança dos dados.
* **Fluxo de Aprovação Completo:**
    1.  O `Vigilante` solicita a troca a um colega da mesma regional.
    2.  O `Colega` precisa aceitar a solicitação.
    3.  A troca é encaminhada para o `Supervisor` da regional para a aprovação final.
* **Dashboard de Ocorrências:** Painel de estatísticas que apresenta dados (Total, Aprovadas, Pendentes, Recusadas, Expiradas) filtrados pela regional do supervisor ou com visão geral para o dono.
* **Sistema de Notificações:** Notificações em tempo real (ícone de sino) para os usuários sobre cada etapa do processo de troca.
* **Perfis de Usuário:** Visualização de perfil com foto e informações de posto e regional.
* **Interface Moderna e Responsiva:** Construído com Tailwind CSS, o design é limpo, moderno, e totalmente adaptável a desktops e dispositivos móveis.
* **Exportação de Dados:** Supervisores e Donos podem exportar o histórico completo de trocas em formato JSON.

## 👤 Estrutura de Papéis (Roles)

| Papel       | Permissões                                                                                                                                                            |
| :---------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vigilante** | • Solicitar trocas com colegas da sua regional.<br>• Aceitar ou recusar solicitações recebidas.<br>• Visualizar apenas o seu histórico de trocas.                      |
| **Supervisor**| • Visualizar o histórico de trocas **apenas da sua regional**.<br>• Aprovar ou recusar solicitações que já foram aceitas pelos colegas.<br>• Acessar o Dashboard com estatísticas da sua regional. |
| **Dono** | • Possui acesso irrestrito.<br>• Visualiza o histórico e o dashboard de **todas as regionais**.<br>• Tem a permissão exclusiva de **excluir** registros de trocas.      |

## 🛠️ Tecnologias Utilizadas

* **Frontend:** HTML5, CSS3, JavaScript (ES6 Modules)
* **Estilização:** [Tailwind CSS](https://tailwindcss.com/)
* **Ícones:** [Font Awesome](https://fontawesome.com/)
* **Backend & Banco de Dados:** [Firebase](https://firebase.google.com/) (Authentication & Firestore Database)
* **Hospedagem:** Firebase Hosting

## ✍️ Créditos

Feito por **[@jordanlvs](https://www.linkedin.com/in/jordanlvs) - WebLv**.
