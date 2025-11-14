/**
 * useTranslation Hook
 * 
 * Provides translation functionality for the application
 */

import { useCallback } from 'react';
import { useI18n } from './useI18n';

// Translation strings (same as server)
const translations: Record<string, Record<string, any>> = {
  en: {
    common: {
      welcome: 'Welcome',
      logout: 'Logout',
      settings: 'Settings',
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      add: 'Add',
      search: 'Search',
    },
    order: {
      title: 'Orders',
      create: 'Create Order',
      status: 'Status',
      total: 'Total',
      items: 'Items',
      completed: 'Completed',
      pending: 'Pending',
      failed: 'Failed',
    },
    payment: {
      title: 'Payment',
      method: 'Payment Method',
      amount: 'Amount',
      currency: 'Currency',
      success: 'Payment Successful',
      failed: 'Payment Failed',
    },
  },
  zh: {
    common: {
      welcome: '欢迎',
      logout: '退出登录',
      settings: '设置',
      save: '保存',
      cancel: '取消',
      delete: '删除',
      edit: '编辑',
      add: '添加',
      search: '搜索',
    },
    order: {
      title: '订单',
      create: '创建订单',
      status: '状态',
      total: '总计',
      items: '项目',
      completed: '已完成',
      pending: '待处理',
      failed: '失败',
    },
    payment: {
      title: '支付',
      method: '支付方式',
      amount: '金额',
      currency: '货币',
      success: '支付成功',
      failed: '支付失败',
    },
  },
  es: {
    common: {
      welcome: 'Bienvenido',
      logout: 'Cerrar sesión',
      settings: 'Configuración',
      save: 'Guardar',
      cancel: 'Cancelar',
      delete: 'Eliminar',
      edit: 'Editar',
      add: 'Añadir',
      search: 'Buscar',
    },
    order: {
      title: 'Pedidos',
      create: 'Crear Pedido',
      status: 'Estado',
      total: 'Total',
      items: 'Artículos',
      completed: 'Completado',
      pending: 'Pendiente',
      failed: 'Fallido',
    },
    payment: {
      title: 'Pago',
      method: 'Método de Pago',
      amount: 'Cantidad',
      currency: 'Moneda',
      success: 'Pago Exitoso',
      failed: 'Pago Fallido',
    },
  },
  fr: {
    common: {
      welcome: 'Bienvenue',
      logout: 'Déconnexion',
      settings: 'Paramètres',
      save: 'Enregistrer',
      cancel: 'Annuler',
      delete: 'Supprimer',
      edit: 'Modifier',
      add: 'Ajouter',
      search: 'Rechercher',
    },
    order: {
      title: 'Commandes',
      create: 'Créer une Commande',
      status: 'Statut',
      total: 'Total',
      items: 'Articles',
      completed: 'Complété',
      pending: 'En attente',
      failed: 'Échoué',
    },
    payment: {
      title: 'Paiement',
      method: 'Méthode de Paiement',
      amount: 'Montant',
      currency: 'Devise',
      success: 'Paiement Réussi',
      failed: 'Paiement Échoué',
    },
  },
};

export function useTranslation() {
  const { language } = useI18n();

  const t = useCallback(
    (key: string): string => {
      const keys = key.split('.');
      let value: any = translations[language];

      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = value[k];
        } else {
          return key; // Return key if translation not found
        }
      }

      return typeof value === 'string' ? value : key;
    },
    [language]
  );

  return t;
}
