// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, remove, update, get } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-database.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-auth.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCJ4VhGD49H3RNifMf9VCRPnkALAxNpsOU",
    authDomain: "project-2980864980936907935.firebaseapp.com",
    databaseURL: "https://project-2980864980936907935-default-rtdb.firebaseio.com",
    projectId: "project-2980864980936907935",
    storageBucket: "project-2980864980936907935.appspot.com",
    messagingSenderId: "580110751353",
    appId: "1:580110751353:web:8f039f9b34e1709d4126a8",
    measurementId: "G-R3JNPHCFZG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);

// Cloudinary configuration
const CLOUDINARY_UPLOAD_PRESET = 'your_upload_preset';
const CLOUDINARY_CLOUD_NAME = 'your_cloud_name';
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

// Application variables
let currentUser = null;
let currentUserType = null;

// DOM elements
const screens = {
    roleSelection: document.getElementById('roleSelection'),
    clientLogin: document.getElementById('clientLogin'),
    barberLogin: document.getElementById('barberLogin'),
    clientDashboard: document.getElementById('clientDashboard'),
    barberDashboard: document.getElementById('barberDashboard')
};

// Helper functions
function showScreen(screenId) {
    Object.values(screens).forEach(screen => {
        screen.classList.add('hidden');
    });
    screens[screenId].classList.remove('hidden');
}

function showError(element, message) {
    element.textContent = message;
    element.classList.remove('hidden');
}

function showBarberSignup() {
    document.getElementById('barberFormTitle').textContent = 'إنشاء حساب حلاق جديد';
    document.getElementById('barberLoginForm').classList.add('hidden');
    document.getElementById('barberSignupForm').classList.remove('hidden');
}

function showBarberLogin() {
    document.getElementById('barberFormTitle').textContent = 'تسجيل الدخول للحلاقين';
    document.getElementById('barberSignupForm').classList.add('hidden');
    document.getElementById('barberLoginForm').classList.remove('hidden');
}

// Image compression
async function compressImage(file) {
    const options = {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 800,
        useWebWorker: true
    };
    
    try {
        return await imageCompression(file, options);
    } catch (error) {
        console.error('Error compressing image:', error);
        return file;
    }
}

// Upload image to Cloudinary
async function uploadImage(file) {
    const progressBar = document.querySelector('.progress-bar');
    const progressElement = document.getElementById('uploadProgress');
    
    progressBar.classList.remove('hidden');
    progressElement.style.width = '0%';
    
    const compressedFile = await compressImage(file);
    const formData = new FormData();
    formData.append('file', compressedFile);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    
    try {
        const response = await fetch(CLOUDINARY_URL, {
            method: 'POST',
            body: formData,
            onUploadProgress: (progressEvent) => {
                const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
                progressElement.style.width = `${progress}%`;
            }
        });
        
        const data = await response.json();
        progressBar.classList.add('hidden');
        return data.secure_url;
    } catch (error) {
        progressBar.classList.add('hidden');
        console.error('Error uploading image:', error);
        throw error;
    }
}

// Barber signup with image upload
async function barberSignup() {
    const name = document.getElementById('barberName').value.trim();
    const phone = document.getElementById('newBarberPhone').value.trim();
    const password = document.getElementById('newBarberPassword').value;
    const confirmPassword = document.getElementById('confirmBarberPassword').value;
    const imageFile = document.getElementById('barberImage').files[0];
    const errorElement = document.getElementById('barberError');
    const signupBtn = document.getElementById('signupBtn');
    
    // Reset error
    errorElement.textContent = '';
    errorElement.classList.add('hidden');
    
    // Validate inputs
    if (!name || !phone || !password || !confirmPassword) {
        showError(errorElement, 'جميع الحقول مطلوبة');
        return;
    }
    
    if (!/^[0-9]{10,15}$/.test(phone)) {
        showError(errorElement, 'رقم الهاتف يجب أن يكون بين 10-15 رقمًا');
        return;
    }
    
    if (password.length < 6) {
        showError(errorElement, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
        return;
    }
    
    if (password !== confirmPassword) {
        showError(errorElement, 'كلمتا المرور غير متطابقتين');
        return;
    }
    
    // Disable button during processing
    signupBtn.disabled = true;
    signupBtn.innerHTML = '<span class="loading"></span> جاري إنشاء الحساب...';
    
    try {
        // Upload image if exists
        let imageUrl = null;
        if (imageFile) {
            try {
                imageUrl = await uploadImage(imageFile);
            } catch (uploadError) {
                showError(errorElement, 'فشل رفع صورة الحلاق');
                throw uploadError;
            }
        }
        
        // Create auth account
        const userCredential = await createUserWithEmailAndPassword(
            auth, 
            `${phone}@barber.com`, 
            password
        );
        
        // Save additional user data
        await set(ref(database, 'barbers/' + userCredential.user.uid), {
            name: name,
            phone: phone,
            imageUrl: imageUrl,
            status: 'open',
            queue: {},
            createdAt: new Date().toISOString()
        });
        
        // Success - set current user and redirect
        currentUser = {
            id: userCredential.user.uid,
            name: name,
            phone: phone,
            imageUrl: imageUrl,
            type: 'barber'
        };
        
        // Update avatar
        const avatarImg = document.getElementById('barberAvatarImg');
        if (imageUrl) {
            avatarImg.src = imageUrl;
            avatarImg.style.display = 'block';
        } else {
            document.getElementById('barberAvatar').textContent = name.charAt(0);
        }
        
        showBarberDashboard();
        loadBarberQueue();
        
    } catch (error) {
        let errorMessage = 'حدث خطأ أثناء إنشاء الحساب';
        
        switch(error.code) {
            case 'auth/email-already-in-use':
                errorMessage = 'هذا الرقم مسجل بالفعل';
                break;
            case 'auth/invalid-email':
                errorMessage = 'بريد إلكتروني غير صالح';
                break;
            case 'auth/weak-password':
                errorMessage = 'كلمة المرور ضعيفة جداً';
                break;
            case 'auth/network-request-failed':
                errorMessage = 'مشكلة في الاتصال بالشبكة';
                break;
            default:
                errorMessage = error.message || 'حدث خطأ غير متوقع';
        }
        
        showError(errorElement, errorMessage);
        console.error('Signup error:', error);
    } finally {
        signupBtn.disabled = false;
        signupBtn.textContent = 'إنشاء حساب';
    }
}

// Barber login
async function barberLogin() {
    const phone = document.getElementById('barberPhone').value.trim();
    const password = document.getElementById('barberPassword').value;
    const errorElement = document.getElementById('barberError');
    const loginBtn = document.querySelector('#barberLoginForm .login-btn');
    
    // Reset error
    errorElement.textContent = '';
    errorElement.classList.add('hidden');
    
    // Validate
    if (!phone || !password) {
        showError(errorElement, 'رقم الهاتف وكلمة المرور مطلوبان');
        return;
    }
    
    // Disable button during processing
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="loading"></span> جاري تسجيل الدخول...';
    
    try {
        const userCredential = await signInWithEmailAndPassword(
            auth,
            `${phone}@barber.com`,
            password
        );
        
        // Get additional user data
        const snapshot = await get(ref(database, 'barbers/' + userCredential.user.uid));
        
        if (snapshot.exists()) {
            const barberData = snapshot.val();
            currentUser = {
                id: userCredential.user.uid,
                name: barberData.name,
                phone: barberData.phone,
                imageUrl: barberData.imageUrl,
                type: 'barber'
            };
            
            // Update avatar
            const avatarImg = document.getElementById('barberAvatarImg');
            if (barberData.imageUrl) {
                avatarImg.src = barberData.imageUrl;
                avatarImg.style.display = 'block';
            } else {
                document.getElementById('barberAvatar').textContent = barberData.name.charAt(0);
            }
            
            showBarberDashboard();
            loadBarberQueue();
        } else {
            await signOut(auth);
            showError(errorElement, 'بيانات الحلاق غير موجودة في النظام');
        }
    } catch (error) {
        let errorMessage = 'بيانات الدخول غير صحيحة';
        
        switch(error.code) {
            case 'auth/user-not-found':
                errorMessage = 'لا يوجد حساب مرتبط بهذا الرقم';
                break;
            case 'auth/wrong-password':
                errorMessage = 'كلمة المرور غير صحيحة';
                break;
            case 'auth/network-request-failed':
                errorMessage = 'مشكلة في الاتصال بالشبكة';
                break;
            default:
                errorMessage = error.message || 'حدث خطأ غير متوقع';
        }
        
        showError(errorElement, errorMessage);
        console.error('Login error:', error);
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = 'تسجيل الدخول';
    }
}

// Client login
async function clientLogin() {
    const name = document.getElementById('clientName').value.trim();
    const phone = document.getElementById('clientPhone').value.trim();
    const errorElement = document.getElementById('clientError');
    
    // Validate
    if (!name) {
        showError(errorElement, 'الرجاء إدخال الاسم');
        return;
    }
    
    if (!phone || !/^[0-9]{10,15}$/.test(phone)) {
        showError(errorElement, 'الرجاء إدخال رقم هاتف صحيح');
        return;
    }
    
    // Set current client
    currentUser = {
        id: generateId(),
        name: name,
        phone: phone,
        type: 'client'
    };
    
    // Update avatar
    document.getElementById('clientAvatar').textContent = name.charAt(0);
    
    // Show dashboard
    showClientDashboard();
    await loadBarbers();
}

// Show barber dashboard
function showBarberDashboard() {
    showScreen('barberDashboard');
    
    // Setup shop status toggle
    const statusToggle = document.getElementById('statusToggle');
    const statusText = document.getElementById('statusText');
    
    // Load shop status from Firebase
    onValue(ref(database, 'barbers/' + currentUser.id + '/status'), (snapshot) => {
        const status = snapshot.val() || 'open';
        statusToggle.checked = status === 'open';
        statusText.textContent = status === 'open' ? 'مفتوح' : 'مغلق';
    });
    
    // Update shop status when changed
    statusToggle.addEventListener('change', function() {
        const newStatus = this.checked ? 'open' : 'closed';
        update(ref(database, 'barbers/' + currentUser.id), { status: newStatus });
    });
}

// Show client dashboard
function showClientDashboard() {
    showScreen('clientDashboard');
    
    // Load current booking if exists
    if (currentUser && currentUser.booking) {
        showCurrentBooking();
    } else {
        document.getElementById('currentBookingContainer').classList.add('hidden');
    }
}

// Load barbers list
async function loadBarbers() {
    const barbersList = document.getElementById('barbersList');
    barbersList.innerHTML = 'جارٍ التحميل...';
    
    onValue(ref(database, '
