/**
 * Firebase Backend API
 * Reemplaza el BackendAPI simulado de App.tsx con llamadas reales a Firestore
 * 
 * NOTA: Este es un archivo de inicio. Agrega más métodos según necesites.
 * Ver README_FIREBASE.md para más detalles sobre cómo extenderlo.
 */

import {
  collection, doc, getDoc, getDocs, setDoc, addDoc,
  updateDoc, deleteDoc, query, where, Timestamp
} from 'firebase/firestore';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { db, auth } from './firebase';

// ============ AUTH ============

export async function login(username: string, pin: string) {
  const email = username.includes('@') ? username : `${username}@eltriunfo.local`;
  const cred = await signInWithEmailAndPassword(auth, email, pin);
  const userDoc = await getDoc(doc(db, 'users', cred.user.uid));
  const userData = userDoc.data();
  return { user: userData, token: 'jwt_token' };
}

// ============ PRODUCTS ============

export async function getStoreProducts(tenantId: string, storeId: string) {
  const q = query(
    collection(db, 'products'),
    where('tenantId', '==', tenantId),
    where('storeId', '==', storeId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function saveProduct(product: any) {
  if (product.id) {
    await setDoc(doc(db, 'products', product.id), product);
  } else {
    const ref = await addDoc(collection(db, 'products'), product);
    product.id = ref.id;
  }
  return product;
}

// ============ SALES ============

export async function processSale(saleData: any) {
  const ref = await addDoc(collection(db, 'sales'), {
    ...saleData,
    timestamp: Timestamp.now()
  });
  return { id: ref.id, ...saleData };
}

// ============ SHIFTS ============

export async function openShift(shiftData: any) {
  const ref = await addDoc(collection(db, 'shifts'), {
    ...shiftData,
    status: 'OPEN',
    startTime: Timestamp.now()
  });
  return { id: ref.id, ...shiftData };
}

export async function getActiveShift(userId: string, storeId: string) {
  const q = query(
    collection(db, 'shifts'),
    where('userId', '==', userId),
    where('storeId', '==', storeId),
    where('status', '==', 'OPEN')
  );
  const snap = await getDocs(q);
  return snap.docs[0] ? { id: snap.docs[0].id, ...snap.docs[0].data() } : null;
}

// Puedes agregar más métodos aquí según los necesites:
// - closeShift, getClients, saveClient, deleteClient, getSales, etc.
