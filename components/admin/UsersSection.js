"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import {
  FaWallet, FaCoins, FaBell, FaWhatsapp, FaTrash,
  FaCommentDots, FaUserCheck, FaUserSlash, FaBuilding, FaUserPlus, FaSearch
} from "react-icons/fa";
import { MdEmail, MdPhone, MdClose, MdEdit } from "react-icons/md";
import { createUserWithEmailAndPassword } from "firebase/auth";
import {
  collection, doc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, query, where
} from "firebase/firestore";
import { firestore, auth } from "@/lib/firebase.client";
import ChatWidgetFull from "@/components/ClientChat/ChatWidgetFull";

const typeTabs = [
  { key: "all", label: "الكل", icon: <FaUserPlus /> },
  { key: "resident", label: "المقيمين", icon: <FaUserCheck /> },
  { key: "nonResident", label: "غير المقيمين", icon: <FaUserSlash /> },
  { key: "company", label: "الشركات", icon: <FaBuilding /> }
];

const typeLabel = {
  resident: "مقيم",
  nonResident: "غير مقيم",
  company: "شركة"
};

function clientTypeIcon(type) {
  switch (type) {
    case "company":
      return <FaBuilding className="text-indigo-600 mr-1" />;
    case "resident":
      return <FaUserCheck className="text-emerald-500 mr-1" />;
    case "nonResident":
      return <FaUserSlash className="text-orange-400 mr-1" />;
    default:
      return null;
  }
}

function StatusChip({ status }) {
  const map = {
    active: { label: "نشط", color: "bg-emerald-200 text-emerald-800" },
    banned: { label: "محظور", color: "bg-red-200 text-red-700" },
    inactive: { label: "غير نشط", color: "bg-gray-200 text-gray-600" },
    suspended: { label: "معلق", color: "bg-yellow-100 text-yellow-700" }
  };
  const obj = map[status] || map.inactive;
  return (
    <span className={`px-3 py-1 rounded-full font-bold shadow text-xs ${obj.color} border border-gray-200`}>
      {obj.label}
    </span>
  );
}

async function generateUniqueClientNumber(type) {
  let prefix = "";
  if (type === "resident") prefix = "RES";
  else if (type === "nonResident") prefix = "NON";
  else prefix = "COM";
  const clientsSnap = await getDocs(
    query(collection(firestore, "users"), where("type", "==", type))
  );
  const numbers = [];
  clientsSnap.forEach(docSnap => {
    const client = docSnap.data();
    if (client.clientNumber && client.clientNumber.startsWith(prefix)) {
      const match = client.clientNumber.match(/(\d{3})-(\d{4})$/);
      if (match) numbers.push(parseInt(match[1] + match[2], 10));
    }
  });
  let next = 1;
  if (numbers.length) next = Math.max(...numbers) + 1;
  const serial3 = String(Math.floor(next / 10000)).padStart(3, "0");
  const serial4 = String(next % 10000).padStart(4, "0");
  return `${prefix}-${serial3}-${serial4}`;
}

function UsersManagementSection({ lang = "ar" }) {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState("all");
  const [edit, setEdit] = useState(false);
  const [editData, setEditData] = useState({});
  const [addNew, setAddNew] = useState(false);
  const [addData, setAddData] = useState({
    type: "resident",
    name: "",
    email: "",
    password: "",
    phone: ""
  });
  const [notifyText, setNotifyText] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  useEffect(() => {
    const usersRef = collection(firestore, "users");
    const unsub = onSnapshot(usersRef, (snap) => {
      const arr = [];
      snap.forEach(docSnap => {
        const user = docSnap.data();
        if (user.role === "client") arr.push({ ...user, uid: docSnap.id });
      });
      setClients(arr);
    });
    return () => unsub();
  }, []);

  const list = tab === "all" ? clients : clients.filter((c) => c.type === tab);
  const filtered = list.filter((u) =>
    [u.name, u.email, u.phone, u.clientNumber]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const handleEditOpen = (client) => {
    setEditData({ ...client });
    setEditError("");
    setEdit(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    setEditError("");
    try {
      await updateDoc(doc(firestore, "users", editData.uid), {
        ...editData
      });
      setEdit(false);
      setSelected({ ...editData });
    } catch (err) {
      setEditError("حدث خطأ أثناء تحديث البيانات");
    }
    setEditLoading(false);
  };

  const handleNotify = (client) => {
    if (!notifyText.trim()) {
      alert("يرجى كتابة نص الإشعار أولاً");
      return;
    }
    alert(`تم إرسال الإشعار إلى ${client.name}:\n${notifyText}`);
    setNotifyText("");
  };

  const handleWhatsApp = (client) =>
    window.open(`https://wa.me/${client.phone.replace(/^0/, "971")}`, "_blank");

  const handleToggleStatus = async (client) => {
    const newStatus = client.status === "active" ? "inactive" : "active";
    await updateDoc(doc(firestore, "users", client.uid), { status: newStatus });
    setSelected((prev) =>
      prev ? { ...prev, status: newStatus } : null
    );
  };

  const handleDelete = async (client) => {
    if (window.confirm(`تأكيد حذف: ${client.name}?`)) {
      await deleteDoc(doc(firestore, "users", client.uid));
      setSelected(null);
    }
  };

  const handleAddClient = async (e) => {
    e.preventDefault();
    setAddError("");
    if (!addData.name || !addData.email || !addData.password || !addData.phone) {
      setAddError("يرجى إدخال كل البيانات!");
      return;
    }
    setAddLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, addData.email, addData.password);
      const { user } = userCredential;
      const clientNumber = await generateUniqueClientNumber(addData.type);
      const clientData = {
        clientNumber,
        name: addData.name,
        type: addData.type,
        profilePic: "",
        email: addData.email,
        phone: addData.phone,
        status: "active",
        wallet: 0,
        coins: 0,
        role: "client",
        attachments: [],
        registeredAt: new Date().toISOString(),
        uid: user.uid
      };
      await setDoc(doc(firestore, "users", user.uid), clientData);
      setAddNew(false);
      setAddData({
        type: "resident",
        name: "",
        email: "",
        password: "",
        phone: ""
      });
    } catch (err) {
      setAddError(err?.message || "حدث خطأ أثناء إنشاء العميل");
    }
    setAddLoading(false);
  };

  const handleOpenCard = (client) => {
    setSelected(client);
    setShowChat(false);
  };

  // ====== UI Layout ======

  return (
    <div className="p-0 bg-gradient-to-br from-[#f6fbf8] to-[#f5faff] min-h-screen">
      {/* Sticky/Floating Add Button */}
      <button
        className="fixed bottom-7 right-7 z-50 bg-gradient-to-tr from-emerald-600 to-emerald-400 text-white rounded-full p-4 shadow-2xl flex items-center gap-2 hover:scale-110 transition transform font-bold text-lg"
        onClick={() => setAddNew(true)}
        title="إضافة عميل"
        style={{boxShadow: "0 8px 24px 0 #2dd4bf44"}}
      >
        <FaUserPlus /> <span className="hidden sm:inline">{lang === "ar" ? "إضافة عميل" : "Add Client"}</span>
      </button>

      {/* Header */}
      <div className="py-10 px-4 sm:px-10 flex flex-col md:flex-row md:justify-between items-center gap-6 mb-7 bg-gradient-to-r from-emerald-100 to-white border-b border-emerald-50">
        <div>
          <div className="flex items-center gap-4 mb-3">
            <FaUserPlus className="text-emerald-500 text-3xl" />
            <h1 className="text-3xl font-extrabold text-emerald-900 tracking-tight">
              {lang === "ar" ? "إدارة العملاء" : "Clients Management"}
            </h1>
          </div>
          <div className="flex gap-4 text-base font-bold">
            <div className="flex flex-col items-center bg-white/90 rounded-lg px-6 py-2 shadow border border-emerald-50 min-w-24">
              <span className="text-gray-500 text-xs">{lang === "ar" ? "الكل" : "Total"}</span>
              <span className="text-emerald-800 text-xl">{list.length}</span>
            </div>
            <div className="flex flex-col items-center bg-white/90 rounded-lg px-6 py-2 shadow border border-emerald-50 min-w-24">
              <span className="text-gray-500 text-xs">{lang === "ar" ? "نشط" : "Active"}</span>
              <span className="text-emerald-600 text-xl">
                {list.filter((c) => c.status === "active").length}
              </span>
            </div>
            <div className="flex flex-col items-center bg-white/90 rounded-lg px-6 py-2 shadow border border-emerald-50 min-w-24">
              <span className="text-gray-500 text-xs">{lang === "ar" ? "محظور" : "Banned"}</span>
              <span className="text-red-500 text-xl">
                {list.filter((c) => c.status === "banned").length}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <FaSearch className="absolute left-3 top-3 text-emerald-400" />
            <input
              className="border rounded-full pl-10 pr-3 py-2 text-gray-700 bg-white/90 w-full shadow-sm focus:border-emerald-400"
              placeholder="بحث بالاسم أو البريد أو الهاتف أو الرقم..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {/* زر الإضافة أصبح عائم */}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-4 sm:px-10 mb-7">
        {typeTabs.map((t) => (
          <button
            key={t.key}
            className={`flex items-center gap-2 px-5 py-2 font-bold rounded-full border-2 cursor-pointer transition text-base shadow-sm 
              ${tab === t.key
                ? "border-emerald-600 text-emerald-700 bg-white shadow"
                : "border-gray-100 text-gray-500 bg-gray-50 hover:bg-emerald-50"
              }`}
            onClick={() => setTab(t.key)}
            style={{ minWidth: 120, justifyContent: "center" }}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl shadow bg-white/95 mb-2 mx-2 sm:mx-10">
        <table className="min-w-full">
          <thead>
            <tr className="bg-emerald-50 text-emerald-800 text-sm">
              <th className="py-2 px-4"></th>
              <th className="py-2 px-4">الاسم</th>
              <th className="py-2 px-4">النوع</th>
              <th className="py-2 px-4">رقم العميل</th>
              <th className="py-2 px-4">الحالة</th>
              <th className="py-2 px-4">البريد</th>
              <th className="py-2 px-4">الهاتف</th>
              <th className="py-2 px-4">الرصيد</th>
              <th className="py-2 px-4">الكوينات</th>
              <th className="py-2 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((client) => (
              <tr key={client.uid} className="text-center hover:bg-emerald-50 transition">
                <td>
                  <img
                    src={client.profilePic || "/default-avatar.png"}
                    alt={client.name}
                    className="w-11 h-11 rounded-full object-cover inline-block border-2 border-emerald-100 cursor-pointer shadow"
                    onClick={() => handleOpenCard(client)}
                  />
                </td>
                <td
                  className="py-2 px-4 font-semibold text-emerald-900 cursor-pointer hover:underline"
                  onClick={() => handleOpenCard(client)}
                >
                  {client.name}
                </td>
                <td
                  className="py-2 px-4 font-bold text-indigo-600 cursor-pointer hover:underline"
                  onClick={() => handleOpenCard(client)}
                >
                  {typeLabel[client.type]}
                </td>
                <td
                  className="py-2 px-4 font-mono font-bold text-emerald-800 cursor-pointer hover:underline"
                  onClick={() => handleOpenCard(client)}
                >
                  {client.clientNumber}
                </td>
                <td className="py-2 px-4">
                  <StatusChip status={client.status}/>
                </td>
                <td className="py-2 px-4 text-gray-700">{client.email}</td>
                <td className="py-2 px-4 text-gray-700">{client.phone}</td>
                <td className="py-2 px-4 font-bold text-emerald-700">{client.wallet} درهم</td>
                <td className="py-2 px-4 font-bold text-yellow-600">{client.coins}</td>
                <td className="py-2 px-4"></td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="py-6 text-center text-gray-400">
                  لا يوجد عملاء بهذه البيانات.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {/* بطاقة العميل & التعديل & الإضافة كما في كودك الحالي بدون تعديل كبير (أضف ظل وخلفية شفافة فقط) */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="relative">
            <button
              className="absolute top-3 left-3 sm:left-auto sm:right-3 text-gray-500 hover:text-gray-900 font-bold cursor-pointer text-2xl z-20"
              onClick={() => setSelected(null)}
              title="إغلاق"
              style={{zIndex: 60}}
            >
              <MdClose />
            </button>
            {renderClientCard(selected)}
          </div>
        </div>
      )}

      {edit && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 relative animate-fade-in border-2 border-emerald-100">
            <button
              className="absolute top-2 left-2 text-gray-500 hover:text-gray-900 font-bold cursor-pointer text-2xl"
              onClick={() => setEdit(false)}
              title="إغلاق"
            >
              <MdClose />
            </button>
            <form
              className="flex flex-col gap-4"
              onSubmit={handleSaveEdit}
            >
              <div className="text-lg font-bold text-center mb-2 text-emerald-800">تعديل بيانات العميل</div>
              {editError && <div className="bg-red-100 text-red-800 p-2 rounded">{editError}</div>}
              <div>
                <label className="block mb-1 text-sm font-bold text-gray-700">الاسم:</label>
                <input className="border rounded px-3 py-2 w-full text-gray-900" value={editData.name} onChange={e=>setEditData({...editData, name: e.target.value})} placeholder="الاسم"/>
              </div>
              <div>
                <label className="block mb-1 text-sm font-bold text-gray-700">النوع:</label>
                <select
                  className="border rounded px-3 py-2 w-full text-gray-900"
                  value={editData.type}
                  onChange={e=>setEditData({...editData, type: e.target.value})}
                >
                  <option value="resident">مقيم</option>
                  <option value="nonResident">غير مقيم</option>
                  <option value="company">شركة</option>
                </select>
              </div>
              <div>
                <label className="block mb-1 text-sm font-bold text-gray-700">البريد الإلكتروني:</label>
                <input className="border rounded px-3 py-2 w-full text-gray-900" value={editData.email} onChange={e=>setEditData({...editData, email: e.target.value})} placeholder="البريد"/>
              </div>
              <div>
                <label className="block mb-1 text-sm font-bold text-gray-700">الهاتف:</label>
                <input className="border rounded px-3 py-2 w-full text-gray-900" value={editData.phone} onChange={e=>setEditData({...editData, phone: e.target.value})} placeholder="الهاتف"/>
              </div>
              <div>
                <label className="block mb-1 text-sm font-bold text-gray-700">المحفظة:</label>
                <input className="border rounded px-3 py-2 w-full text-gray-900" value={editData.wallet} onChange={e=>setEditData({...editData, wallet: +e.target.value})} placeholder="المحفظة" type="number"/>
              </div>
              <div>
                <label className="block mb-1 text-sm font-bold text-gray-700">الكوينات:</label>
                <input className="border rounded px-3 py-2 w-full text-gray-900" value={editData.coins} onChange={e=>setEditData({...editData, coins: +e.target.value})} placeholder="الكوينات" type="number"/>
              </div>
              <div className="flex gap-2 justify-center mt-2">
                <button type="submit" disabled={editLoading} className="bg-emerald-600 text-white rounded px-6 py-2 font-bold cursor-pointer shadow">حفظ</button>
                <button type="button" className="bg-gray-400 text-white rounded px-6 py-2 font-bold cursor-pointer shadow" onClick={()=>setEdit(false)}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {addNew && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-8 relative animate-fade-in border-2 border-emerald-200">
            <button
              className="absolute top-2 left-2 text-gray-500 hover:text-gray-900 font-bold cursor-pointer text-2xl"
              onClick={() => setAddNew(false)}
              title="إغلاق"
            >
              <MdClose />
            </button>
            <form
              className="flex flex-col gap-4"
              onSubmit={handleAddClient}
            >
              <div className="text-lg font-bold text-center mb-2 text-emerald-800 flex items-center gap-2 justify-center">
                <FaUserPlus /> إضافة عميل جديد
              </div>
              {addError && <div className="bg-red-100 text-red-800 p-2 rounded">{addError}</div>}
              <div>
                <label className="block mb-1 text-sm font-bold text-gray-700">نوع العميل:</label>
                <select
                  className="border rounded px-3 py-2 w-full text-gray-800"
                  value={addData.type}
                  onChange={e=>setAddData({...addData, type: e.target.value})}
                >
                  <option value="resident">مقيم</option>
                  <option value="nonResident">غير مقيم</option>
                  <option value="company">شركة</option>
                </select>
                <span className="text-xs text-gray-500 mt-1 block">
                  اختر نوع العميل (مثال: مقيم، غير مقيم، أو شركة)
                </span>
              </div>
              <div>
                <label className="block mb-1 text-sm font-bold text-gray-700">الاسم:</label>
                <input className="border rounded px-3 py-2 w-full text-gray-900" value={addData.name} onChange={e=>setAddData({...addData, name: e.target.value})} placeholder="اسم العميل (مثال: محمد أو شركة التميز)" />
              </div>
              <div>
                <label className="block mb-1 text-sm font-bold text-gray-700">البريد الإلكتروني:</label>
                <input className="border rounded px-3 py-2 w-full text-gray-900" value={addData.email} onChange={e=>setAddData({...addData, email: e.target.value})} placeholder="ادخل البريد الإلكتروني الصحيح" type="email" />
                <span className="text-xs text-gray-500 mt-1 block">سيتم استخدام البريد لتسجيل الدخول</span>
              </div>
              <div>
                <label className="block mb-1 text-sm font-bold text-gray-700">كلمة المرور:</label>
                <input className="border rounded px-3 py-2 w-full text-gray-900" value={addData.password} onChange={e=>setAddData({...addData, password: e.target.value})} placeholder="كلمة المرور (يفضل أن تكون قوية)" type="password" />
                <span className="text-xs text-gray-500 mt-1 block">سيستخدم العميل كلمة المرور لتسجيل الدخول</span>
              </div>
              <div>
                <label className="block mb-1 text-sm font-bold text-gray-700">الهاتف:</label>
                <input className="border rounded px-3 py-2 w-full text-gray-900" value={addData.phone} onChange={e=>setAddData({...addData, phone: e.target.value})} placeholder="رقم الهاتف (مثال: 05XXXXXXXX)" />
                <span className="text-xs text-gray-500 mt-1 block">يرجى التأكد من صحة رقم الهاتف</span>
              </div>
              <div className="flex gap-2 justify-center mt-2">
                <button type="submit" disabled={addLoading} className="bg-emerald-600 text-white rounded px-6 py-2 font-bold cursor-pointer shadow flex items-center gap-1">
                  <FaUserPlus /> {addLoading ? "جاري الإضافة..." : "إضافة"}
                </button>
                <button type="button" className="bg-gray-400 text-white rounded px-6 py-2 font-bold cursor-pointer shadow" onClick={()=>setAddNew(false)}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default UsersManagementSection;