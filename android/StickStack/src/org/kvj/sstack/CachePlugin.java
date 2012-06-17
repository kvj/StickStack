package org.kvj.sstack;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

import org.apache.cordova.api.CordovaInterface;
import org.apache.cordova.api.PluginResult.Status;
import org.apache.http.HttpEntity;
import org.apache.http.HttpHost;
import org.apache.http.HttpResponse;
import org.apache.http.client.HttpClient;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.conn.params.ConnRouteParams;
import org.apache.http.conn.scheme.PlainSocketFactory;
import org.apache.http.conn.scheme.Scheme;
import org.apache.http.conn.scheme.SchemeRegistry;
import org.apache.http.entity.mime.HttpMultipartMode;
import org.apache.http.entity.mime.MultipartEntity;
import org.apache.http.entity.mime.content.FileBody;
import org.apache.http.impl.client.DefaultHttpClient;
import org.apache.http.impl.conn.tsccm.ThreadSafeClientConnManager;
import org.apache.http.params.HttpParams;
import org.json.JSONArray;
import org.json.JSONException;

import android.net.Proxy;
import android.os.AsyncTask;
import android.os.Handler;

import com.phonegap.api.Plugin;
import com.phonegap.api.PluginResult;

public class CachePlugin extends Plugin {

	File cacheFolder = null;
	private Handler handler = null;
	private static final String GET_ACTION = "get";
	private static final String DOWNLOAD_ACTION = "download";
	private static final String UPLOAD_ACTION = "upload";
	private static final String REMOVE_ACTION = "remove";
	private static final String COPY_ACTION = "copy";
	protected static final String TAG = "CachePlugin";

	public CachePlugin() {
		super();
		handler = new Handler();
	}

	@Override
	public void setContext(CordovaInterface ctx) {
		super.setContext(ctx);
		cacheFolder = ctx.getApplicationContext().getExternalCacheDir();
		if (null == cacheFolder) {
			return;
		}
		cacheFolder = new File(cacheFolder, "file-cache");
		if (!cacheFolder.exists()) {
			if (!cacheFolder.mkdirs()) {
				cacheFolder = null;
				return;
			}
		}
	}

	@Override
	public boolean isSynch(String action) {
		if (GET_ACTION.equals(action)) {
			return true;
		}
		if (REMOVE_ACTION.equals(action)) {
			return true;
		}
		return false;
	}

	private HttpClient createHttpClient() {
		String proxyHost = Proxy.getHost(ctx.getApplicationContext());
		int proxyPort = Proxy.getPort(ctx.getApplicationContext());
		DefaultHttpClient httpClient = new DefaultHttpClient();
		HttpParams params = httpClient.getParams();
		SchemeRegistry schemeRegistry = new SchemeRegistry();
		schemeRegistry.register(new Scheme("http", PlainSocketFactory
				.getSocketFactory(), 80));
		ThreadSafeClientConnManager cm = new ThreadSafeClientConnManager(
				params, schemeRegistry);
		httpClient.setParams(params);

		if (proxyHost != null && proxyPort > 0) {
			params.setParameter(ConnRouteParams.DEFAULT_PROXY, new HttpHost(
					proxyHost, proxyPort));
		}
		DefaultHttpClient nHttpClient = new DefaultHttpClient(cm, params);
		return nHttpClient;

	}

	private void removeFile(String name) {
		if (null == cacheFolder) {
			return;
		}
		File file = new File(cacheFolder, name);
		if (file.exists()) {
			file.delete();
		}
	}

	private String getFile(String name) {
		if (null == cacheFolder) {
			return null;
		}
		File file = new File(cacheFolder, name);
		if (file.exists()) {
			return file.toURI().toString();
		}
		return null;
	}

	private void uploadFile(final String name, final String url,
			final String callback) {
		AsyncTask<Void, Void, String> task = new AsyncTask<Void, Void, String>() {

			@Override
			protected String doInBackground(Void... params) {
				if (null == cacheFolder) {
					return "IO error";
				}
				File file = new File(cacheFolder, name);
				if (!file.exists()) {
					return "File not found";
				}
				try {
					HttpClient client = createHttpClient();
					HttpPost post = new HttpPost(url);
					MultipartEntity entity = new MultipartEntity(
							HttpMultipartMode.BROWSER_COMPATIBLE);
					entity.addPart("file", new FileBody(file,
							"application/octet-stream"));
					post.setEntity(entity);
					HttpResponse response = client.execute(post);
					HttpEntity outentity = response.getEntity();
					outentity.consumeContent();
					return null;
				} catch (Exception e) {
					e.printStackTrace();
					return e.getMessage();
				}
			}

			@Override
			protected void onPostExecute(String result) {
				if (null == result) {
					success(getFile(name), callback);
				} else {
					error(result, callback);
				}
			}

		};
		task.execute();
	}

	private void copyStreams(InputStream in, OutputStream out)
			throws IOException {
		BufferedInputStream bis = new BufferedInputStream(in);
		BufferedOutputStream bos = new BufferedOutputStream(out);
		byte[] buffer = new byte[4096];
		int bytes = 0;
		while ((bytes = bis.read(buffer)) > 0) {
			bos.write(buffer, 0, bytes);
		}
		bis.close();
		bos.close();
	}

	private void downloadFile(final String name, final String url,
			final String callback) {
		AsyncTask<Void, Void, String> task = new AsyncTask<Void, Void, String>() {

			@Override
			protected String doInBackground(Void... params) {
				if (null == cacheFolder) {
					return "IO error";
				}
				try {
					HttpClient client = createHttpClient();
					HttpGet get = new HttpGet(url);
					HttpResponse response = client.execute(get);
					HttpEntity entity = response.getEntity();
					copyStreams(entity.getContent(), new FileOutputStream(
							new File(cacheFolder, name)));

					return null;
				} catch (Exception e) {
					e.printStackTrace();
					return e.getMessage();
				}
			}

			@Override
			protected void onPostExecute(String result) {
				if (null == result) {
					success(getFile(name), callback);
				} else {
					error(result, callback);
				}
			}

		};
		task.execute();
	}

	private void copyFile(final String name, final String path,
			final String callback) {
		AsyncTask<Void, Void, String> task = new AsyncTask<Void, Void, String>() {

			@Override
			protected String doInBackground(Void... params) {
				if (null == cacheFolder) {
					return "IO error";
				}
				File fromFile = new File(path);
				if (!fromFile.exists()) {
					return "File not found";
				}
				try {
					copyStreams(new FileInputStream(fromFile),
							new FileOutputStream(new File(cacheFolder, name)));
					return null;
				} catch (Exception e) {
					e.printStackTrace();
					return e.getMessage();
				}
			}

			@Override
			protected void onPostExecute(String result) {
				if (null == result) {
					success(getFile(name), callback);
				} else {
					error(result, callback);
				}
			}

		};
		task.execute();
	}

	@Override
	public PluginResult execute(String action, final JSONArray params,
			final String callback) {
		PluginResult noResult = new PluginResult(Status.NO_RESULT);
		noResult.setKeepCallback(true);
		if (GET_ACTION.equals(action)) {
			try {
				String url = getFile(params.getString(0));
				if (null == url) {
					return new PluginResult(Status.ERROR, "File not found");
				} else {
					return new PluginResult(Status.OK, url);
				}
			} catch (JSONException e) {
				e.printStackTrace();
			}
		}
		if (REMOVE_ACTION.equals(action)) {
			try {
				removeFile(params.getString(0));
				return new PluginResult(Status.OK);
			} catch (JSONException e) {
				e.printStackTrace();
			}
		}
		if (DOWNLOAD_ACTION.equals(action)) {
			handler.post(new Runnable() {

				@Override
				public void run() {
					try {
						downloadFile(params.getString(0), params.getString(1),
								callback);
					} catch (Exception e) {
						e.printStackTrace();
						error(e.getMessage(), callback);
					}
				}
			});
			return noResult;
		}
		if (UPLOAD_ACTION.equals(action)) {
			handler.post(new Runnable() {

				@Override
				public void run() {
					try {
						uploadFile(params.getString(0), params.getString(1),
								callback);
					} catch (Exception e) {
						e.printStackTrace();
						error(e.getMessage(), callback);
					}
				}
			});
			return noResult;
		}
		if (COPY_ACTION.equals(action)) {
			handler.post(new Runnable() {

				@Override
				public void run() {
					try {
						copyFile(params.getString(0), params.getString(1),
								callback);
					} catch (Exception e) {
						e.printStackTrace();
						error(e.getMessage(), callback);
					}
				}
			});
			return noResult;
		}
		return new PluginResult(Status.ERROR);
	}

}
